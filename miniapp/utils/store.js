/**
 * 本地存储层
 * ---------------------------------------------------------------------------
 * 所有业务数据先落在本地，界面永远读本地。
 * 云数据库只负责「备份 + 多端同步」，不是界面的直接数据源。
 *
 * 这样做的两个好处：
 *   1. 断网、没开云环境时，功能完全不掉线
 *   2. 列表页不用等网络，打开就有数据
 *
 * 每条记录带四个同步用的元字段：
 *   updatedAt  最后修改时间（毫秒），冲突时用来比新旧
 *   rev        修改版本号，同毫秒时用 rev 决胜
 *   _deleted   软删除标记（真删会导致其他端收不到删除事件）
 *   _dirty     本地改过但还没推上云
 */

const PREFIX = 'qy:'
const COLLS = [
  'members',
  'records',
  'memberCards',
  'levels',
  'cardTypes',
  'services',
  'config'
]

const collKey = (coll) => PREFIX + 'coll:' + coll
const META_KEY = PREFIX + 'meta'
const OUTBOX_KEY = PREFIX + 'outbox'

/* ------------------------------ 基础读写 ------------------------------ */

function readColl(coll) {
  try {
    const v = wx.getStorageSync(collKey(coll))
    return Array.isArray(v) ? v : []
  } catch (e) {
    console.error('[store] 读取失败', coll, e)
    return []
  }
}

function writeColl(coll, list) {
  try {
    wx.setStorageSync(collKey(coll), list)
    return true
  } catch (e) {
    // 存储满了会走到这里，用控制台能看到是哪个集合
    console.error('[store] 写入失败', coll, e)
    return false
  }
}

function readJSON(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    return v === '' || v === undefined || v === null ? fallback : v
  } catch (e) {
    return fallback
  }
}

function writeJSON(key, val) {
  try {
    wx.setStorageSync(key, val)
    return true
  } catch (e) {
    console.error('[store] 写入失败', key, e)
    return false
  }
}

/* ------------------------------ 工具函数 ------------------------------ */

function uid(prefix) {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return (prefix || 'id') + '_' + t + r
}

function now() {
  return Date.now()
}

/* ------------------------------ 元信息 ------------------------------ */

/**
 * meta 结构：
 *   lastSyncAt   上次同步成功的时间戳
 *   mode         'local' | 'cloud'   当前数据源
 *   schemaVersion 本地数据结构版本，将来改字段靠它做迁移
 */
function getMeta() {
  return readJSON(META_KEY, {
    lastSyncAt: 0,
    mode: 'local',
    schemaVersion: 1
  })
}

function setMeta(patch) {
  const next = Object.assign(getMeta(), patch || {})
  writeJSON(META_KEY, next)
  return next
}

/* ------------------------------ 查询 ------------------------------ */

/** 取一个集合里所有未删除的记录 */
function all(coll) {
  return readColl(coll).filter((r) => !r._deleted)
}

/** 按 _id 取一条 */
function findById(coll, id) {
  return readColl(coll).find((r) => r._id === id) || null
}

/** 单条件查询 */
function where(coll, predicate) {
  return all(coll).filter(predicate)
}

/* ------------------------------ 写入 ------------------------------ */

/**
 * 新建或覆盖一条记录（会标脏 + 进发件箱）
 * @returns 写入后的记录
 */
function put(coll, doc) {
  if (COLLS.indexOf(coll) < 0) {
    throw new Error('未知集合: ' + coll)
  }
  const list = readColl(coll)
  const i = list.findIndex((r) => r._id === doc._id)

  const base = i >= 0 ? list[i] : {}
  const ts = now()
  const next = Object.assign({}, base, doc, {
    updatedAt: ts,
    rev: (base.rev || 0) + 1,
    _deleted: false,
    _dirty: true
  })

  if (i >= 0) list[i] = next
  else list.push(next)

  writeColl(coll, list)
  enqueue({ coll, op: 'upsert', id: next._id, doc: next })
  return next
}

/** 局部更新，只改传入的字段 */
function patch(coll, id, changes) {
  const cur = findById(coll, id)
  if (!cur) throw new Error('记录不存在: ' + id)
  return put(coll, Object.assign({}, cur, changes, { _id: id }))
}

/**
 * 软删除。不真的从数组里移除，只打标记。
 * 否则另一台设备拉数据时收不到「这条被删了」的信号。
 */
function remove(coll, id) {
  const list = readColl(coll)
  const i = list.findIndex((r) => r._id === id)
  if (i < 0) return false

  list[i] = Object.assign({}, list[i], {
    _deleted: true,
    _dirty: true,
    updatedAt: now(),
    rev: (list[i].rev || 0) + 1
  })
  writeColl(coll, list)
  enqueue({ coll, op: 'delete', id })
  return true
}

/* ------------------------------ 发件箱 ------------------------------ */

/**
 * 发件箱 = 本地改了但还没推上云的操作队列。
 * 没网时它就一直攒着，网络回来按顺序补发。
 *
 * 这里做了「合并同名操作」：同一条记录连续改 5 次，
 * 只留最后一次，避免补发时做 5 次无用同步。
 */
function getOutbox() {
  const v = readJSON(OUTBOX_KEY, [])
  return Array.isArray(v) ? v : []
}

function enqueue(op) {
  const box = getOutbox()
  const entry = Object.assign({ ts: now() }, op)

  // 同一条记录已有待发操作时，直接替换
  const i = box.findIndex(
    (e) => e.coll === op.coll && e.id === op.id
  )
  if (i >= 0) box[i] = entry
  else box.push(entry)

  writeJSON(OUTBOX_KEY, box)
  return box.length
}

function dequeue(doneIds) {
  const ids = doneIds || []
  const box = getOutbox().filter((e) => ids.indexOf(e.id) < 0)
  writeJSON(OUTBOX_KEY, box)
  return box.length
}

function clearOutbox() {
  writeJSON(OUTBOX_KEY, [])
}

function pendingCount() {
  return getOutbox().length
}

/* ------------------------------ 远端合并 ------------------------------ */

/**
 * 把从云端拉回来的记录合进本地。
 *
 * 冲突策略：最后写入者胜（Last Write Wins）
 *   - 云端更新 → 直接覆盖本地
 *   - 本地更新 → 保留本地，等下一次推送覆盖云端
 *   - 时间相同 → 比 rev，大的赢
 *
 * 为什么用 LWW 而不是合并字段：会员余额这种数字没法「合并」，
 * 只能认一个。LWW 简单、可预测，对单店多人操作够用。
 */
function mergeRemote(coll, remoteList) {
  const local = readColl(coll)
  const byId = new Map(local.map((r) => [r._id, r]))
  let changed = 0

  for (const r of remoteList) {
    if (!r || !r._id) continue
    const cur = byId.get(r._id)

    if (!cur) {
      byId.set(r._id, Object.assign({}, r, { _dirty: false }))
      changed++
      continue
    }

    // 本地有未推送的修改，先不覆盖，交给 push 去解决
    if (cur._dirty) continue

    const remoteNewer =
      (r.updatedAt || 0) > (cur.updatedAt || 0) ||
      ((r.updatedAt || 0) === (cur.updatedAt || 0) && (r.rev || 0) > (cur.rev || 0))

    if (remoteNewer) {
      byId.set(r._id, Object.assign({}, r, { _dirty: false }))
      changed++
    }
  }

  if (changed) {
    writeColl(coll, Array.from(byId.values()))
  }
  return changed
}

/** 推送成功后把记录的脏标记清掉 */
function markClean(coll, id, serverDoc) {
  const list = readColl(coll)
  const i = list.findIndex((r) => r._id === id)
  if (i < 0) return
  list[i] = Object.assign({}, list[i], serverDoc || {}, { _dirty: false })
  writeColl(coll, list)
}

/* ------------------------------ 维护 ------------------------------ */

/** 统计各集合记录数，设置页展示用 */
function stats() {
  const out = {}
  COLLS.forEach((c) => {
    out[c] = all(c).length
  })
  out.pending = pendingCount()
  out.meta = getMeta()
  return out
}

/** 清空全部本地数据（危险操作，设置页放在二级确认后） */
function resetAll() {
  COLLS.forEach((c) => {
    try {
      wx.removeStorageSync(collKey(c))
    } catch (e) {}
  })
  try {
    wx.removeStorageSync(OUTBOX_KEY)
  } catch (e) {}
  setMeta({ lastSyncAt: 0 })
}

module.exports = {
  COLLS,
  uid,
  now,
  all,
  findById,
  where,
  put,
  patch,
  remove,
  readColl,
  writeColl,
  getMeta,
  setMeta,
  getOutbox,
  enqueue,
  dequeue,
  clearOutbox,
  pendingCount,
  mergeRemote,
  markClean,
  stats,
  resetAll
}
