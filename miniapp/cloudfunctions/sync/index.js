/**
 * 云函数：sync
 * ---------------------------------------------------------------------------
 * 负责和本地存储之间的双向同步。
 *
 * push  把本地发件箱里的操作写进云数据库
 * pull  按 updatedAt 增量拉取云端变更
 *
 * 设计要点：
 *   1. 每条记录都带 updatedAt / rev，用于客户端做 LWW 冲突判断
 *   2. 删除用软删除（_deleted: true），否则别的设备收不到删除事件
 *   3. 时间统一用服务端时间，避免各端时钟不一致
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 白名单，防止客户端写到别的集合
const COLLS = [
  'members',
  'records',
  'memberCards',
  'levels',
  'cardTypes',
  'services',
  'config'
]

// 这些集合由云函数统一维护，不接受客户端直接改余额
const NO_DIRECT_WRITE = ['records']

exports.main = async (event) => {
  const { action } = event || {}

  try {
    if (action === 'push') return await push(event)
    if (action === 'pull') return await pull(event)
    if (action === 'ping') return { ok: true, data: { serverTime: Date.now() } }
    return { ok: false, msg: '未知操作: ' + action }
  } catch (e) {
    console.error('[sync]', action, e)
    return { ok: false, msg: e.message || '同步失败' }
  }
}

/* ------------------------------ push ------------------------------ */

async function push({ coll, op, id, doc }) {
  if (COLLS.indexOf(coll) < 0) {
    return { ok: false, msg: '非法的集合: ' + coll }
  }
  if (NO_DIRECT_WRITE.indexOf(coll) >= 0) {
    return { ok: false, msg: '该集合不允许直接写入' }
  }
  if (!id) return { ok: false, msg: '缺少记录 id' }

  const stamp = {
    updatedAt: Date.now(),
    rev: _.inc(1),
    _deleted: op === 'delete'
  }

  // 去掉客户端带来的同步元字段，以服务端为准
  const data = Object.assign({}, doc || {})
  delete data._id
  delete data._openid
  delete data._dirty

  if (op === 'delete') {
    await db.collection(coll).doc(id).update({
      data: { _deleted: true, updatedAt: Date.now(), rev: _.inc(1) }
    })
    return { ok: true, data: { id } }
  }

  // upsert：有就更新，没有就建（用 set 保持 _id 一致）
  const payload = Object.assign({}, data, stamp)
  if (isNaN(payload.rev)) payload.rev = 1

  await db.collection(coll).doc(id).set({ data: payload })

  const saved = await db.collection(coll).doc(id).get()
  return { ok: true, data: { doc: saved.data } }
}

/* ------------------------------ pull ------------------------------ */

async function pull({ coll, since }) {
  if (COLLS.indexOf(coll) < 0) {
    return { ok: false, msg: '非法的集合: ' + coll }
  }

  const from = Number(since) || 0
  const where = from > 0 ? { updatedAt: _.gt(from) } : {}

  // 单次上限 100 条，客户端可循环拉取
  const res = await db
    .collection(coll)
    .where(where)
    .orderBy('updatedAt', 'asc')
    .limit(100)
    .get()

  return {
    ok: true,
    data: {
      list: res.data,
      serverTime: Date.now(),
      // 还有更多未拉完时，客户端应继续拉
      hasMore: res.data.length >= 100
    }
  }
}
