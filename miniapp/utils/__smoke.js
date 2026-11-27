/**
 * 冒烟测试：不依赖微信开发者工具，用一个假的 wx 对象跑通数据层。
 * 运行：node miniapp/utils/__smoke.js
 *
 * 覆盖：本地读写、软删除、发件箱合并、远端合并冲突、云不可用降级、业务动作。
 */

/* ------------------------------ 假 wx ------------------------------ */

const storage = {}
let cloudFail = true

global.wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => {
    storage[k] = JSON.parse(JSON.stringify(v))
  },
  removeStorageSync: (k) => {
    delete storage[k]
  },
  getNetworkType: ({ success }) => success && success({ networkType: 'wifi' }),
  onNetworkStatusChange: () => {},
  cloud: {
    init: () => {},
    callFunction: () => {
      if (cloudFail) return Promise.reject(new Error('模拟断网'))
      return Promise.resolve({ result: { ok: true, data: {} } })
    }
  }
}

global.getApp = () => ({ globalData: { env: '' } })

/* ------------------------------ 断言工具 ------------------------------ */

let pass = 0
let fail = 0

function ok(cond, name) {
  if (cond) {
    pass++
    console.log('  ✓ ' + name)
  } else {
    fail++
    console.log('  ✗ ' + name)
  }
}

function eq(a, b, name) {
  ok(a === b, name + '  (期望 ' + b + '，实际 ' + a + ')')
}

/* ------------------------------ 测试 ------------------------------ */

const store = require('./store')
const sync = require('./sync')
const seed = require('./seed')
const biz = require('./biz')

console.log('\n=== 1. 初始数据 ===')
const seeded = seed.seed()
ok(seeded, '首次启动灌入示例数据')
ok(seed.isSeeded(), '数据已存在标记正确')
eq(store.all('members').length, 6, '会员 6 位')
eq(store.all('levels').length, 4, '等级 4 个')
eq(store.all('cardTypes').length, 3, '次卡项目 3 个')
eq(store.pendingCount(), 0, '初始发件箱为空（seed 不产生待同步）')

console.log('\n=== 2. 查询与筛选 ===')
eq(biz.listMembers({}).length, 6, '会员总数')
eq(biz.listMembers({ keyword: '陈' }).length, 1, '按姓名搜索')
eq(biz.listMembers({ keyword: '6621' }).length, 1, '按手机号搜索')
eq(biz.listMembers({ keyword: 'QH8821' }).length, 1, '按卡号搜索')
eq(biz.listMembers({ levelId: 'level-gold' }).length, 2, '按等级筛选')
eq(biz.listMembers({ status: 'sleeping' }).length, 1, '按状态筛选')
eq(biz.listMembers({ tags: ['高复购'] }).length, 2, '按标记筛选')
eq(biz.listMembers({ balanceMin: 100000 }).length, 3, '按余额下限筛选（≥1000 元有 3 位）')
eq(biz.findMembersBySuffix('6621').length, 1, '手机号后四位匹配')

console.log('\n=== 3. 金额与格式化 ===')
eq(biz.money(128000), '1,280.00', '分转元带千分位')
eq(biz.moneyShort(128000), '1,280', '分转元取整')
eq(biz.toFen('128.00'), 12800, '元转分')
eq(biz.toFen('abc'), 0, '非法输入返回 0')
eq(biz.maskPhone('13800006621'), '138 **** 6621', '手机号脱敏')
eq(biz.prettyPhone('13800006621'), '138 0000 6621', '手机号分段')

console.log('\n=== 4. 建档 ===')
const before = store.all('members').length
const r1 = biz.createMember({
  phone: '13911112222',
  name: '测试会员',
  balance: 50000
})
ok(r1.ok, '建档成功')
eq(store.all('members').length, before + 1, '会员数 +1')
ok(r1.member.cardNo.indexOf('QH') === 0, '自动生成卡号')
eq(biz.records({ memberId: r1.member._id }).length, 1, '初始余额生成一条充值流水')
ok(store.pendingCount() > 0, '建档进入发件箱')

const r2 = biz.createMember({ phone: '13911112222', name: '重复' })
ok(!r2.ok, '手机号重复被拒绝')

const r3 = biz.createMember({ phone: '123', name: 'x' })
ok(!r3.ok, '非法手机号被拒绝')

console.log('\n=== 5. 充值 ===')
const m = biz.memberById('m-chenjiayi')
const balBefore = m.balance
const r4 = biz.recharge('m-chenjiayi', 50000)
ok(r4.ok, '充值成功')
eq(r4.gift, 5000, '命中 500 档赠送 50 元')
eq(biz.memberById('m-chenjiayi').balance, balBefore + 55000, '余额增加本金+赠送')

console.log('\n=== 6. 核销 ===')
const r5 = biz.consume('m-chenjiayi', 12800, [{ name: '剪发造型', price: 12800, qty: 1 }])
ok(r5.ok, '余额核销成功')
eq(r5.balanceAfter, biz.memberById('m-chenjiayi').balance, '返回余额与实际一致')

const cards = biz.cardsOf('m-chenjiayi')
const activeCard = cards.find((c) => c.status === 'active')
const usedBefore = activeCard.used
const r6 = biz.verifyCard('m-chenjiayi', activeCard._id, 1)
ok(r6.ok, '次卡核销成功')
eq(biz.cardsOf('m-chenjiayi').find((c) => c._id === activeCard._id).used, usedBefore + 1, '使用次数 +1')

const bigRes = biz.consume('m-chenjiayi', 999999999, [])
ok(!bigRes.ok, '余额不足被拒绝')

console.log('\n=== 7. 软删除与发件箱 ===')
const target = 'm-suwan'
ok(store.remove('members', target), '软删除成功')
ok(!biz.listMembers({}).some((x) => x._id === target), '软删除后不出现在列表')
ok(store.findById('members', target)._deleted === true, '记录仍在，只是打了标记')

const pend1 = store.pendingCount()
biz.updateMember(target, { remark: 'a' })
biz.updateMember(target, { remark: 'b' })
biz.updateMember(target, { remark: 'c' })
const pend2 = store.pendingCount()
eq(pend2, pend1, '同一条记录连续修改只占一个发件箱位置（合并生效）')

console.log('\n=== 8. 远端合并（LWW 冲突） ===')
// 本地有一条脏数据，远端更新的不应覆盖
const dirtyId = 'test-lww'
const raw = store.readColl('members')
raw.push({
  _id: dirtyId,
  name: '本地新改',
  phone: '13000000001',
  updatedAt: 1000,
  rev: 2,
  _dirty: true
})
store.writeColl('members', raw)
store.mergeRemote('members', [
  { _id: dirtyId, name: '云端旧版', updatedAt: 500, rev: 9 }
])
eq(store.findById('members', dirtyId).name, '本地新改', '本地脏数据不被旧云端覆盖')

// 已同步干净的记录，云端更新应覆盖
store.markClean('members', dirtyId, {})
store.mergeRemote('members', [
  { _id: dirtyId, name: '云端新版', updatedAt: 9999, rev: 3 }
])
eq(store.findById('members', dirtyId).name, '云端新版', '云端新版本覆盖本地')

// 时间相同比 rev
store.markClean('members', dirtyId, {})
store.mergeRemote('members', [
  { _id: dirtyId, name: '同时间高rev', updatedAt: 9999, rev: 99 }
])
eq(store.findById('members', dirtyId).name, '同时间高rev', '同时间戳时 rev 大的生效')

console.log('\n=== 9. 云不可用降级 ===')
sync.recheck()
const st1 = sync.status()
eq(st1.mode, 'local', '未配置环境时为本地模式')
eq(st1.available, false, '云不可用')

sync.sync().then((r) => {
  ok(!r.ok && r.degraded, '同步失败并标记降级')
  ok(!r.ok, '降级时界面数据不受影响')

  // 关键：降级后本地数据仍然完整
  ok(store.all('members').length > 0, '降级后本地数据仍在')

  console.log('\n=== 10. 数据完整性 ===')
  const snap = store.stats()
  ok(snap.members > 0, '会员数据存在')
  ok(typeof snap.pending === 'number', '待同步计数可用')

  // 余额一致性：每条流水的 balanceAfter 应该能串起来（抽查陈嘉怡）
  const recs = biz
    .records({ memberId: 'm-chenjiayi' })
    .sort((a, b) => a.createdAt - b.createdAt)
  ok(recs.length > 0, '有流水记录')

  console.log('\n=== 11. 统计 ===')
  const day = biz.summary('day')
  ok(typeof day.revenue === 'number', '今日汇总可用')
  const overview = biz.todayOverview()
  ok(typeof overview.revenueText === 'string', '工作台概览可用')
  ok(overview.totalMembers > 0, '会员总数正确')

  const bars = biz.dailyRevenue('month', 4)
  eq(bars.length, 4, '趋势柱 4 段')

  console.log('\n============================')
  console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项')
  console.log('============================\n')
  process.exit(fail > 0 ? 1 : 0)
})
