/**
 * 云同步层
 * ---------------------------------------------------------------------------
 * 职责：把本地数据推到云数据库、把云端数据拉回本地。
 * 云不可用时（没开环境、断网、超时、报错）自动降级为纯本地模式，
 * 界面完全不感知——永远读 store，读写都先在本地落地。
 *
 * 同步策略：
 *   push  发件箱里攒的操作按顺序推上云
 *   pull  按 updatedAt 增量拉云端的变更
 *   冲突  Last Write Wins（见 store.mergeRemote）
 *
 * 何时触发：
 *   启动时、页面显示时（节流）、手动点「立即同步」、网络恢复时
 */

const store = require('./store')

/* ------------------------------ 状态 ------------------------------ */

const SYNC_INTERVAL = 60 * 1000 // 自动同步最小间隔，避免频繁打云函数
const CLOUD_TIMEOUT = 8000 // 单次云调用超时

const state = {
  available: null, // null 未探测 / true 可用 / false 不可用
  syncing: false,
  lastError: '',
  lastSyncAt: 0,
  pending: 0,
  online: true
}

let cloudInited = false

/* ------------------------------ 环境探测 ------------------------------ */

/**
 * 判断云开发能不能用。三个条件缺一不可：
 *   1. wx.cloud 存在（基础库够新）
 *   2. app.js 里配了 env
 *   3. 初始化没抛异常
 */
function probe() {
  if (state.available !== null) return state.available

  try {
    if (!wx.cloud) {
      state.available = false
      state.lastError = '基础库不支持云开发'
      return false
    }

    const app = getApp()
    const env = app && app.globalData && app.globalData.env

    if (!env || env === 'YOUR_ENV_ID') {
      state.available = false
      state.lastError = '未配置云环境'
      return false
    }

    if (!cloudInited) {
      wx.cloud.init({ env, traceUser: true })
      cloudInited = true
    }

    state.available = true
    state.lastError = ''
    return true
  } catch (e) {
    state.available = false
    state.lastError = e.message || '云开发初始化失败'
    return false
  }
}

/** 手动重置探测结果（设置页「重试」按钮用） */
function recheck() {
  state.available = null
  cloudInited = false
  return probe()
}

/* ------------------------------ 云调用封装 ------------------------------ */

/** 带超时和错误捕获的云函数调用，失败一律抛错交给上层降级 */
function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('云函数超时'))
    }, CLOUD_TIMEOUT)

    wx.cloud
      .callFunction({ name, data: data || {} })
      .then((res) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const r = (res && res.result) || {}
        if (r.ok === false) reject(new Error(r.msg || '云端返回失败'))
        else resolve(r.data)
      })
      .catch((e) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(e)
      })
  })
}

/** 把云调用失败统一转成「降级」，不往上抛 */
function degrade(e) {
  state.available = false
  state.lastError = (e && e.message) || '云服务不可用'
  store.setMeta({ mode: 'local' })
  return { ok: false, degraded: true, msg: state.lastError }
}

/* ------------------------------ 推送 ------------------------------ */

/**
 * 把发件箱推上云。
 * 逐条推，某一条失败就停下——因为后面的操作可能依赖前一条（先建会员再充值）。
 */
async function push() {
  const box = store.getOutbox()
  if (!box.length) return { ok: true, pushed: 0 }

  const done = []
  for (const op of box) {
    try {
      const res = await callCloud('sync', {
        action: 'push',
        coll: op.coll,
        op: op.op,
        id: op.id,
        doc: op.doc || null
      })
      store.markClean(op.coll, op.id, res && res.doc)
      done.push(op.id)
    } catch (e) {
      // 一条失败就停，保留剩余队列下次再来
      if (done.length) store.dequeue(done)
      throw e
    }
  }

  store.dequeue(done)
  return { ok: true, pushed: done.length }
}

/* ------------------------------ 拉取 ------------------------------ */

/**
 * 增量拉取。只拉比本地 lastSyncAt 新的记录，避免每次全量。
 * 首次同步（lastSyncAt = 0）会拉全量。
 */
async function pull(force) {
  const meta = store.getMeta()
  const since = force ? 0 : meta.lastSyncAt || 0

  let totalChanged = 0
  let serverTime = Date.now()

  for (const coll of store.COLLS) {
    const res = await callCloud('sync', {
      action: 'pull',
      coll,
      since
    })
    const list = (res && res.list) || []  // res 已被 callCloud 解包成 data
    // 服务端时间做下一次的游标，避免本地时钟慢导致的漏拉
    totalChanged += store.mergeRemote(coll, list)
    if (res && res.serverTime) serverTime = Math.max(serverTime, res.serverTime)
  }

  store.setMeta({ lastSyncAt: serverTime, mode: 'cloud' })
  return { ok: true, changed: totalChanged }
}

/* ------------------------------ 完整同步 ------------------------------ */

/**
 * 一次完整同步：先推后拉。
 * 顺序不能反——先拉会把本地未推送的修改判成冲突。
 */
async function sync(options) {
  if (state.syncing) return { ok: false, msg: '正在同步中' }

  if (!probe()) {
    return { ok: false, degraded: true, msg: state.lastError || '云服务不可用' }
  }

  state.syncing = true
  state.pending = store.pendingCount()

  try {
    const pushRes = await push()
    const pullRes = await pull(options && options.force)

    state.lastSyncAt = Date.now()
    state.lastError = ''
    state.pending = store.pendingCount()
    store.setMeta({ mode: 'cloud', lastSyncAt: state.lastSyncAt })

    return {
      ok: true,
      pushed: pushRes.pushed || 0,
      changed: pullRes.changed || 0
    }
  } catch (e) {
    return degrade(e)
  } finally {
    state.syncing = false
  }
}

/**
 * 节流版同步：页面 onShow 时调，60 秒内不重复触发。
 * 页面不需要关心有没有云，调这个就行。
 */
let lastAutoAt = 0
function autoSync() {
  if (Date.now() - lastAutoAt < SYNC_INTERVAL) return Promise.resolve({ ok: true, skipped: true })
  lastAutoAt = Date.now()
  return sync()
}

/* ------------------------------ 网络感知 ------------------------------ */

let networkBound = false

/** 监听网络变化，恢复时自动补同步 */
function bindNetwork() {
  if (networkBound) return
  networkBound = true

  wx.getNetworkType({
    success: (res) => {
      state.online = res.networkType !== 'none'
    }
  })

  wx.onNetworkStatusChange((res) => {
    const wasOffline = !state.online
    state.online = res.isConnected
    if (res.isConnected && wasOffline) {
      // 断网期间攒了一堆操作，恢复后立刻补
      if (state.available !== false) sync()
    }
  })
}

/* ------------------------------ 对外接口 ------------------------------ */

/** 给界面用的、永远不会抛错的状态快照 */
function status() {
  const meta = store.getMeta()
  return {
    available: state.available === true,
    mode: state.available === true ? 'cloud' : 'local',
    syncing: state.syncing,
    online: state.online,
    pending: store.pendingCount(),
    lastSyncAt: state.lastSyncAt || meta.lastSyncAt || 0,
    lastError: state.lastError
  }
}

module.exports = {
  probe,
  recheck,
  sync,
  autoSync,
  status,
  bindNetwork,
  callCloud,
  degrade,
  // 单独暴露，方便测试
  push,
  pull
}
