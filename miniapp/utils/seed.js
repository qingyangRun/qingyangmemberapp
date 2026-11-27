/**
 * 初始示例数据
 * ---------------------------------------------------------------------------
 * 首次启动（本地无任何数据）时灌一份，让界面不是空的。
 * 金额一律存「分」。
 *
 * 数据全部为虚构，手机号已脱敏，与真实个人或商户无关。
 */

const store = require('./store')

const YUAN = 100

function d(offsetDays) {
  const t = new Date()
  t.setDate(t.getDate() + (offsetDays || 0))
  return t.getTime()
}

/* ------------------------------ 等级 ------------------------------ */

const LEVELS = [
  {
    _id: 'level-black',
    name: '黑金卡',
    sort: 4,
    rechargeThreshold: 5000 * YUAN,
    consumeThreshold: 8000 * YUAN,
    discount: 0.85,
    pointRate: 2,
    birthdayGift: true,
    onSale: true
  },
  {
    _id: 'level-gold',
    name: '金卡',
    sort: 3,
    rechargeThreshold: 2000 * YUAN,
    consumeThreshold: 3000 * YUAN,
    discount: 0.9,
    pointRate: 1.5,
    birthdayGift: true,
    onSale: true
  },
  {
    _id: 'level-silver',
    name: '银卡',
    sort: 2,
    rechargeThreshold: 500 * YUAN,
    consumeThreshold: 800 * YUAN,
    discount: 0.95,
    pointRate: 1,
    birthdayGift: false,
    onSale: true
  },
  {
    _id: 'level-normal',
    name: '普通',
    sort: 1,
    rechargeThreshold: 0,
    consumeThreshold: 0,
    discount: 1,
    pointRate: 1,
    birthdayGift: false,
    onSale: true
  }
]

/* ------------------------------ 次卡项目 ------------------------------ */

const CARD_TYPES = [
  { _id: 'ct-haircut', name: '剪发次卡', times: 12, price: 680 * YUAN, validDays: 365, onSale: true, sort: 3 },
  { _id: 'ct-scalp', name: '头皮护理', times: 6, price: 900 * YUAN, validDays: 365, onSale: true, sort: 2 },
  { _id: 'ct-dye', name: '染发次卡', times: 3, price: 1200 * YUAN, validDays: 180, onSale: false, sort: 1 }
]

/* ------------------------------ 服务项 ------------------------------ */

const SERVICES = [
  { _id: 'sv-wash', name: '洗吹', price: 68 * YUAN, onSale: true, sort: 4 },
  { _id: 'sv-cut', name: '剪发造型', price: 128 * YUAN, onSale: true, sort: 3 },
  { _id: 'sv-dye', name: '染发', price: 388 * YUAN, onSale: true, sort: 2 },
  { _id: 'sv-scalp', name: '头皮护理', price: 228 * YUAN, onSale: true, sort: 1 }
]

/* ------------------------------ 会员 ------------------------------ */

const MEMBERS = [
  {
    _id: 'm-chenjiayi',
    name: '陈嘉怡',
    phone: '13800006621',
    gender: 'female',
    birthday: '1995-11-08',
    levelId: 'level-gold',
    balance: 1280 * YUAN,
    points: 640,
    totalRecharge: 6420 * YUAN,
    totalConsume: 6420 * YUAN,
    cardNo: 'QH8821',
    tags: ['高复购', '生日月'],
    status: 'normal',
    remark: '偏好自然卷度，不染深色；每次到店先做头皮舒缓。',
    joinedAt: d(-420),
    lastVisitAt: d(0)
  },
  {
    _id: 'm-zhoumingxuan',
    name: '周明轩',
    phone: '13900000837',
    gender: 'male',
    birthday: '1988-03-14',
    levelId: 'level-black',
    balance: 4860 * YUAN,
    points: 2180,
    totalRecharge: 12800 * YUAN,
    totalConsume: 9600 * YUAN,
    cardNo: 'QH8830',
    tags: ['高复购', '转介绍'],
    status: 'normal',
    remark: '',
    joinedAt: d(-680),
    lastVisitAt: d(-2)
  },
  {
    _id: 'm-linzhiyao',
    name: '林之遥',
    phone: '13700004290',
    gender: 'female',
    birthday: '1997-06-22',
    levelId: 'level-silver',
    balance: 620 * YUAN,
    points: 310,
    totalRecharge: 1200 * YUAN,
    totalConsume: 1580 * YUAN,
    cardNo: 'QH8842',
    tags: ['敏感头皮'],
    status: 'normal',
    remark: '头皮敏感，洗发水用无硅油款。',
    joinedAt: d(-240),
    lastVisitAt: d(-1)
  },
  {
    _id: 'm-suwan',
    name: '苏晚',
    phone: '15000001176',
    gender: 'female',
    birthday: '2001-01-09',
    levelId: 'level-normal',
    balance: 0,
    points: 0,
    totalRecharge: 0,
    totalConsume: 0,
    cardNo: 'QH8855',
    tags: ['新会员'],
    status: 'normal',
    remark: '',
    joinedAt: d(-6),
    lastVisitAt: d(-6)
  },
  {
    _id: 'm-huangshimin',
    name: '黄诗敏',
    phone: '18600005502',
    gender: 'female',
    birthday: '1992-11-25',
    levelId: 'level-gold',
    balance: 2100 * YUAN,
    points: 980,
    totalRecharge: 4800 * YUAN,
    totalConsume: 3260 * YUAN,
    cardNo: 'QH8861',
    tags: ['只做烫染'],
    status: 'normal',
    remark: '只做烫染，不做剪发。',
    joinedAt: d(-350),
    lastVisitAt: d(-9)
  },
  {
    _id: 'm-zhengkaiwen',
    name: '郑凯文',
    phone: '13500009948',
    gender: 'male',
    birthday: '1985-08-30',
    levelId: 'level-silver',
    balance: 340 * YUAN,
    points: 120,
    totalRecharge: 800 * YUAN,
    totalConsume: 620 * YUAN,
    cardNo: 'QH8873',
    tags: ['沉睡唤醒'],
    status: 'sleeping',
    remark: '',
    joinedAt: d(-500),
    lastVisitAt: d(-62)
  }
]

/* ------------------------------ 会员次卡 ------------------------------ */

const MEMBER_CARDS = [
  { _id: 'mc-1', memberId: 'm-chenjiayi', cardTypeId: 'ct-haircut', name: '剪发次卡', total: 12, used: 4, expireAt: d(180), status: 'active', createdAt: d(-180) },
  { _id: 'mc-2', memberId: 'm-chenjiayi', cardTypeId: 'ct-scalp', name: '头皮护理', total: 6, used: 4, expireAt: d(60), status: 'active', createdAt: d(-300) },
  { _id: 'mc-3', memberId: 'm-zhoumingxuan', cardTypeId: 'ct-haircut', name: '剪发次卡', total: 12, used: 3, expireAt: d(240), status: 'active', createdAt: d(-120) },
  { _id: 'mc-4', memberId: 'm-linzhiyao', cardTypeId: 'ct-haircut', name: '剪发次卡', total: 12, used: 4, expireAt: d(150), status: 'active', createdAt: d(-210) },
  { _id: 'mc-5', memberId: 'm-huangshimin', cardTypeId: 'ct-dye', name: '染发次卡', total: 3, used: 3, expireAt: d(-30), status: 'used_up', createdAt: d(-400) }
]

/* ------------------------------ 流水 ------------------------------ */

const RECORDS = [
  { _id: 'r-1', memberId: 'm-chenjiayi', type: 'recharge', amount: 550 * YUAN, delta: 550 * YUAN, balanceAfter: 1280 * YUAN, items: [], remark: '充 500 赠 50', createdAt: d(0) },
  { _id: 'r-2', memberId: 'm-linzhiyao', type: 'cardverify', amount: 0, delta: 0, balanceAfter: 620 * YUAN, items: [{ name: '剪发次卡', price: 0, qty: 1 }], remark: '剩余 8 次', createdAt: d(0) },
  { _id: 'r-3', memberId: 'm-zhoumingxuan', type: 'consume', amount: 388 * YUAN, delta: -388 * YUAN, balanceAfter: 4860 * YUAN, items: [{ name: '染发', price: 388 * YUAN, qty: 1 }], remark: '', createdAt: d(-1) },
  { _id: 'r-4', memberId: 'm-huangshimin', type: 'consume', amount: 128 * YUAN, delta: -128 * YUAN, balanceAfter: 2100 * YUAN, items: [{ name: '剪发造型', price: 128 * YUAN, qty: 1 }], remark: '', createdAt: d(-2) },
  { _id: 'r-5', memberId: 'm-zhoumingxuan', type: 'recharge', amount: 2000 * YUAN, delta: 2000 * YUAN, balanceAfter: 5248 * YUAN, items: [], remark: '', createdAt: d(-5) },
  { _id: 'r-6', memberId: 'm-zhengkaiwen', type: 'consume', amount: 68 * YUAN, delta: -68 * YUAN, balanceAfter: 340 * YUAN, items: [{ name: '洗吹', price: 68 * YUAN, qty: 1 }], remark: '', createdAt: d(-62) }
]

/* ------------------------------ 门店配置 ------------------------------ */

const CONFIG = [
  {
    _id: 'shop',
    shopName: '青禾造型',
    branch: '望京店',
    address: '朝阳区望京 SOHO T1 101',
    manager: '林岚',
    phone: '010-8800 6621',
    shopNo: '0108',
    pointRules: { consume: 1, recharge: 0.5, sign: 5 },
    rechargeTiers: [
      { amount: 200 * YUAN, gift: 0 },
      { amount: 500 * YUAN, gift: 50 * YUAN },
      { amount: 1000 * YUAN, gift: 150 * YUAN },
      { amount: 2000 * YUAN, gift: 400 * YUAN }
    ]
  }
]

/* ------------------------------ 写入 ------------------------------ */

/** 本地已经有数据就不重复灌 */
function isSeeded() {
  return store.all('members').length > 0
}

/**
 * 灌入示例数据。
 * 注意：不走 store.put，因为 seeding 不应该进发件箱——
 * 否则第一次打开就有一堆待推送数据，且会把演示数据推到真实云端。
 */
function seed() {
  if (isSeeded()) return false

  const now = Date.now()
  const stamp = (arr) =>
    arr.map((doc) =>
      Object.assign({}, doc, {
        updatedAt: now,
        rev: 1,
        _deleted: false,
        _dirty: false
      })
    )

  store.writeColl('levels', stamp(LEVELS))
  store.writeColl('cardTypes', stamp(CARD_TYPES))
  store.writeColl('services', stamp(SERVICES))
  store.writeColl('members', stamp(MEMBERS))
  store.writeColl('memberCards', stamp(MEMBER_CARDS))
  store.writeColl('records', stamp(RECORDS))
  store.writeColl('config', stamp(CONFIG))

  store.setMeta({ lastSyncAt: 0, mode: 'local', schemaVersion: 1 })
  return true
}

module.exports = { seed, isSeeded }
