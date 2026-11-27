/**
 * 业务数据层
 * ---------------------------------------------------------------------------
 * 页面只调这一层，不直接碰 store / sync。
 * 每个方法都保证「一定有返回值、不抛错」，因为没网是常态。
 */

const store = require('./store')
const sync = require('./sync')

/* ------------------------------ 格式化 ------------------------------ */

/** 分 → 元字符串，带千分位 */
function money(fen) {
  const n = (Number(fen) || 0) / 100
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/** 分 → 元，整数不带小数（卡片上的大数字用） */
function moneyShort(fen) {
  const n = (Number(fen) || 0) / 100
  return Math.round(n).toLocaleString('zh-CN')
}

/** 元字符串/数字 → 分 */
function toFen(yuan) {
  const n = parseFloat(String(yuan).replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

/** 手机号脱敏：138 0000 6621 → 138 **** 6621 */
function maskPhone(phone) {
  const s = String(phone || '')
  if (s.length !== 11) return s
  return s.slice(0, 3) + ' **** ' + s.slice(7)
}

/** 带空格的手机号：13800006621 → 138 0000 6621 */
function prettyPhone(phone) {
  const s = String(phone || '')
  if (s.length !== 11) return s
  return s.slice(0, 3) + ' ' + s.slice(3, 7) + ' ' + s.slice(7)
}

/** 时间戳 → 11-25 */
function md(ts) {
  const t = new Date(ts || Date.now())
  return (
    String(t.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(t.getDate()).padStart(2, '0')
  )
}

/** 时间戳 → 11-25 10:24 */
function mdhm(ts) {
  const t = new Date(ts || Date.now())
  return (
    md(ts) +
    ' ' +
    String(t.getHours()).padStart(2, '0') +
    ':' +
    String(t.getMinutes()).padStart(2, '0')
  )
}

/** 时间戳 → 2026-11-25 */
function ymd(ts) {
  const t = new Date(ts || Date.now())
  return (
    t.getFullYear() +
    '-' +
    String(t.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(t.getDate()).padStart(2, '0')
  )
}

/** 时间戳 → 相对今天的描述 */
function relativeDay(ts) {
  const t = new Date(ts || 0)
  const today = new Date()
  t.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today - t) / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return days + ' 天前'
  return Math.floor(days / 30) + ' 个月前'
}

/* ------------------------------ 等级 / 配置 ------------------------------ */

function levels() {
  return store.all('levels').sort((a, b) => (b.sort || 0) - (a.sort || 0))
}

function levelById(id) {
  return store.findById('levels', id)
}

function levelName(id) {
  const l = levelById(id)
  return l ? l.name : '普通'
}

/** 等级徽章配色：黑金 / 金 / 银 / 普通 */
function levelBadge(id) {
  const map = {
    'level-black': 'gray',
    'level-gold': 'gold',
    'level-silver': 'blue',
    'level-normal': 'gray'
  }
  return map[id] || 'gray'
}

function config() {
  return store.findById('config', 'shop') || {}
}

function cardTypes() {
  return store.all('cardTypes').sort((a, b) => (b.sort || 0) - (a.sort || 0))
}

function services() {
  return store.all('services').sort((a, b) => (b.sort || 0) - (a.sort || 0))
}

/* ------------------------------ 会员 ------------------------------ */

/**
 * 会员列表 + 筛选
 * @param {object} opt
 *   keyword  姓名 / 手机号 / 卡号
 *   levelId  等级
 *   status   状态
 *   tags     标记数组
 *   balanceMin / balanceMax  余额区间（分）
 */
function listMembers(opt) {
  const o = opt || {}
  let list = store.all('members')

  if (o.keyword) {
    const k = String(o.keyword).toLowerCase().trim()
    list = list.filter(
      (m) =>
        (m.name || '').toLowerCase().indexOf(k) >= 0 ||
        (m.phone || '').indexOf(k) >= 0 ||
        (m.cardNo || '').toLowerCase().indexOf(k) >= 0
    )
  }

  if (o.levelId) list = list.filter((m) => m.levelId === o.levelId)
  if (o.status) list = list.filter((m) => m.status === o.status)

  if (o.tags && o.tags.length) {
    list = list.filter((m) => {
      const mt = m.tags || []
      return o.tags.every((t) => mt.indexOf(t) >= 0)
    })
  }

  if (typeof o.balanceMin === 'number') {
    list = list.filter((m) => (m.balance || 0) >= o.balanceMin)
  }
  if (typeof o.balanceMax === 'number' && o.balanceMax > 0) {
    list = list.filter((m) => (m.balance || 0) <= o.balanceMax)
  }

  return list.sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0))
}

/** 把会员转成列表页直接可渲染的结构（含格式化后的字符串） */
function memberRow(m) {
  const cards = cardsOf(m._id).filter((c) => c.status === 'active')
  const cardLeft = cards.reduce((s, c) => s + Math.max(0, c.total - c.used), 0)

  return {
    id: m._id,
    name: m.name,
    initial: (m.name || '?').slice(0, 1),
    levelId: m.levelId,
    levelName: levelName(m.levelId),
    levelBadge: levelBadge(m.levelId),
    phoneMasked: maskPhone(m.phone),
    cardNo: m.cardNo,
    joinedText: ymd(m.joinedAt),
    balance: m.balance || 0,
    balanceText: moneyShort(m.balance),
    isZero: !m.balance,
    cardText: cardLeft > 0 ? '次卡 ' + cardLeft + ' 次' : '暂无次卡',
    tags: m.tags || [],
    status: m.status,
    lastVisitAt: m.lastVisitAt || 0,
    lastVisitText: relativeDay(m.lastVisitAt),
    // 头像配色按等级走，和设计稿一致
    avaClass:
      m.levelId === 'level-black'
        ? 'dark'
        : m.levelId === 'level-gold'
        ? 'gold'
        : m.levelId === 'level-silver'
        ? ''
        : 'gray'
  }
}

function memberById(id) {
  return store.findById('members', id)
}

/** 按手机号或卡号精确找人（核销页用） */
function findMember(key) {
  const k = String(key || '').trim()
  if (!k) return null
  const all = store.all('members')
  return (
    all.find((m) => m.phone === k) ||
    all.find((m) => (m.cardNo || '').toUpperCase() === k.toUpperCase()) ||
    // 手机号后四位模糊
    all.filter((m) => (m.phone || '').slice(-4) === k)[0] ||
    null
  )
}

/** 后四位模糊匹配，可能多人 */
function findMembersBySuffix(suffix) {
  const s = String(suffix || '').trim()
  if (!s) return []
  return store.all('members').filter((m) => (m.phone || '').slice(-4) === s)
}

/** 新建会员，返回新会员 */
function createMember(payload) {
  const p = payload || {}
  const phone = String(p.phone || '').replace(/\s/g, '')

  if (!/^1\d{10}$/.test(phone)) {
    return { ok: false, msg: '请输入 11 位手机号' }
  }
  if (store.all('members').some((m) => m.phone === phone)) {
    return { ok: false, msg: '该手机号已存在' }
  }

  // 卡号：QH + 4 位序号，跳过已占用的
  const used = new Set(store.all('members').map((m) => m.cardNo))
  let seq = store.all('members').length + 1
  while (used.has('QH' + String(seq).padStart(4, '0'))) seq++
  const cardNo = 'QH' + String(seq).padStart(4, '0')

  const balance = Number(p.balance) || 0
  const ts = Date.now()

  const doc = store.put('members', {
    _id: store.uid('m'),
    name: p.name || '',
    phone,
    gender: p.gender || '',
    birthday: p.birthday || '',
    levelId: p.levelId || 'level-normal',
    balance,
    points: 0,
    totalRecharge: balance,
    totalConsume: 0,
    cardNo,
    tags: p.tags || [],
    status: 'normal',
    remark: p.remark || '',
    joinedAt: ts,
    lastVisitAt: ts
  })

  // 初始余额 > 0 时补一笔充值流水
  if (balance > 0) {
    store.put('records', {
      _id: store.uid('r'),
      memberId: doc._id,
      type: 'recharge',
      amount: balance,
      delta: balance,
      balanceAfter: balance,
      items: [],
      remark: '开卡初始余额',
      createdAt: ts
    })
  }

  // 选了次卡项目就开卡
  if (p.cardTypeIds && p.cardTypeIds.length) {
    p.cardTypeIds.forEach((ctId) => {
      const ct = store.findById('cardTypes', ctId)
      if (!ct) return
      store.put('memberCards', {
        _id: store.uid('mc'),
        memberId: doc._id,
        cardTypeId: ct._id,
        name: ct.name,
        total: ct.times,
        used: 0,
        expireAt: ts + (ct.validDays || 365) * 86400000,
        status: 'active',
        createdAt: ts
      })
    })
  }

  return { ok: true, member: doc }
}

function updateMember(id, changes) {
  const cur = memberById(id)
  if (!cur) return { ok: false, msg: '会员不存在' }

  // 余额和卡号不允许从这里改
  const safe = Object.assign({}, changes)
  delete safe.balance
  delete safe.cardNo
  delete safe.points
  delete safe._id

  const doc = store.patch('members', id, safe)
  return { ok: true, member: doc }
}

function disableMember(id) {
  if (!memberById(id)) return { ok: false, msg: '会员不存在' }
  store.patch('members', id, { status: 'disabled' })
  return { ok: true }
}

/* ------------------------------ 次卡 ------------------------------ */

function cardsOf(memberId) {
  return store
    .where('memberCards', (c) => c.memberId === memberId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

/** 次卡转成界面结构 */
function cardRow(c) {
  const left = Math.max(0, (c.total || 0) - (c.used || 0))
  return {
    id: c._id,
    name: c.name,
    total: c.total,
    used: c.used,
    left,
    leftText: left > 0 ? left + ' / ' + c.total + ' 次' : '已用完',
    expireText: c.expireAt ? '有效期至 ' + ymd(c.expireAt) : '',
    status: c.status,
    isUsedUp: left <= 0
  }
}

/* ------------------------------ 储值 ------------------------------ */

/** 按档位计算赠送金额：命中档位取赠额，自定义金额按最近低档比例折算 */
function calcRechargeGift(tiers, amountFen) {
  if (!tiers || !tiers.length || !amountFen) return 0
  const hit = tiers.find((t) => t.amount === amountFen)
  if (hit) return hit.gift || 0
  const lower = tiers
    .filter((t) => t.amount <= amountFen && t.gift > 0)
    .sort((a, b) => b.amount - a.amount)[0]
  return lower ? Math.floor((amountFen / lower.amount) * lower.gift) : 0
}

/**
 * 充值。赠送规则从 config.rechargeTiers 里按档位取，
 * 自定义金额时按最近的档位比例算。
 */
function recharge(memberId, amountFen, remark) {
  const m = memberById(memberId)
  if (!m) return { ok: false, msg: '会员不存在' }
  if (!amountFen || amountFen <= 0) return { ok: false, msg: '请输入充值金额' }

  const cfg = config()
  const tiers = cfg.rechargeTiers || []
  const gift = calcRechargeGift(tiers, amountFen)
  const total = amountFen + gift

  const after = (m.balance || 0) + total
  const ts = Date.now()

  store.patch('members', memberId, {
    balance: after,
    totalRecharge: (m.totalRecharge || 0) + amountFen,
    lastVisitAt: ts
  })

  store.put('records', {
    _id: store.uid('r'),
    memberId,
    type: 'recharge',
    amount: total,
    delta: total,
    balanceAfter: after,
    items: [],
    remark: remark || (gift ? '充 ' + moneyShort(amountFen) + ' 赠 ' + moneyShort(gift) : ''),
    createdAt: ts
  })

  // 充值积分
  const rate = (cfg.pointRules && cfg.pointRules.recharge) || 0
  if (rate > 0) {
    const pts = Math.floor((amountFen / 100) * rate)
    if (pts > 0) {
      store.patch('members', memberId, { points: (memberById(memberId).points || 0) + pts })
    }
  }

  return { ok: true, member: memberById(memberId), gift, total }
}

/** 购买次卡 */
function buyCard(memberId, cardTypeId) {
  const m = memberById(memberId)
  const ct = store.findById('cardTypes', cardTypeId)
  if (!m || !ct) return { ok: false, msg: '数据不存在' }
  if ((m.balance || 0) < ct.price) return { ok: false, msg: '余额不足' }

  const ts = Date.now()
  const after = m.balance - ct.price

  store.patch('members', memberId, {
    balance: after,
    totalConsume: (m.totalConsume || 0) + ct.price,
    lastVisitAt: ts
  })

  const card = store.put('memberCards', {
    _id: store.uid('mc'),
    memberId,
    cardTypeId: ct._id,
    name: ct.name,
    total: ct.times,
    used: 0,
    expireAt: ts + (ct.validDays || 365) * 86400000,
    status: 'active',
    createdAt: ts
  })

  store.put('records', {
    _id: store.uid('r'),
    memberId,
    type: 'cardbuy',
    amount: ct.price,
    delta: -ct.price,
    balanceAfter: after,
    items: [{ name: ct.name, price: ct.price, qty: 1 }],
    remark: ct.times + ' 次',
    createdAt: ts
  })

  return { ok: true, member: memberById(memberId), card }
}

/* ------------------------------ 核销 ------------------------------ */

/**
 * 余额核销
 * @param items [{ name, price, qty }]
 */
function consume(memberId, amountFen, items) {
  const m = memberById(memberId)
  if (!m) return { ok: false, msg: '会员不存在' }
  if (!amountFen || amountFen <= 0) return { ok: false, msg: '请输入核销金额' }
  if ((m.balance || 0) < amountFen) {
    return { ok: false, msg: '余额不足，当前 ' + money(m.balance) + ' 元' }
  }

  const ts = Date.now()
  const after = m.balance - amountFen

  store.patch('members', memberId, {
    balance: after,
    totalConsume: (m.totalConsume || 0) + amountFen,
    lastVisitAt: ts
  })

  store.put('records', {
    _id: store.uid('r'),
    memberId,
    type: 'consume',
    amount: amountFen,
    delta: -amountFen,
    balanceAfter: after,
    items: items || [],
    remark: '',
    createdAt: ts
  })

  // 消费积分
  const cfg = config()
  const rate = (cfg.pointRules && cfg.pointRules.consume) || 0
  if (rate > 0) {
    const pts = Math.floor((amountFen / 100) * rate)
    if (pts > 0) {
      store.patch('members', memberId, {
        points: (memberById(memberId).points || 0) + pts
      })
    }
  }

  return { ok: true, member: memberById(memberId), balanceAfter: after }
}

/** 次卡核销 */
function verifyCard(memberId, cardId, times) {
  const c = store.findById('memberCards', cardId)
  if (!c) return { ok: false, msg: '次卡不存在' }
  if (c.memberId !== memberId) return { ok: false, msg: '次卡不属于该会员' }

  const n = times || 1
  const left = (c.total || 0) - (c.used || 0)
  if (left < n) return { ok: false, msg: '次数不足，剩余 ' + left + ' 次' }

  const after = c.used + n
  const ts = Date.now()

  store.patch('memberCards', cardId, {
    used: after,
    status: after >= c.total ? 'used_up' : 'active'
  })

  const m = memberById(memberId)
  store.patch('members', memberId, { lastVisitAt: ts })

  store.put('records', {
    _id: store.uid('r'),
    memberId,
    type: 'cardverify',
    amount: 0,
    delta: 0,
    balanceAfter: (m && m.balance) || 0,
    items: [{ name: c.name, price: 0, qty: n }],
    remark: '剩余 ' + (c.total - after) + ' 次',
    createdAt: ts
  })

  return { ok: true, card: store.findById('memberCards', cardId) }
}

/* ------------------------------ 流水 ------------------------------ */

function records(opt) {
  const o = opt || {}
  let list = store.all('records')

  if (o.type) list = list.filter((r) => r.type === o.type)
  if (o.memberId) list = list.filter((r) => r.memberId === o.memberId)
  if (o.from) list = list.filter((r) => (r.createdAt || 0) >= o.from)
  if (o.to) list = list.filter((r) => (r.createdAt || 0) <= o.to)

  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

const RECORD_META = {
  recharge: { name: '余额充值', ic: 'i-wallet', cls: 'recharge' },
  consume: { name: '消费核销', ic: 'i-banknote', cls: 'consume' },
  cardbuy: { name: '次卡购买', ic: 'i-cards', cls: 'cardbuy' },
  cardverify: { name: '次卡核销', ic: 'i-scan', cls: 'verify' }
}

/** 流水转成界面结构 */
function recordRow(r) {
  const m = memberById(r.memberId)
  const meta = RECORD_META[r.type] || { name: '记录', ic: 'i-receipt', cls: '' }

  let amountText = ''
  let amountCls = ''
  if (r.type === 'recharge') {
    amountText = '+' + money(r.amount)
    amountCls = 'in'
  } else if (r.type === 'consume' || r.type === 'cardbuy') {
    amountText = '-' + money(r.amount)
    amountCls = ''
  } else {
    amountText = '核销'
    amountCls = 'muted-amt'
  }

  return {
    id: r._id,
    type: r.type,
    typeName: meta.name,
    ic: meta.ic,
    cls: meta.cls,
    memberName: (m && m.name) || '未知会员',
    title: ((m && m.name) || '未知会员') + ' · ' + meta.name,
    timeText: mdhm(r.createdAt),
    remark: r.remark || '',
    amountText,
    amountCls
  }
}

/* ------------------------------ 统计 ------------------------------ */

function rangeOf(kind) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (kind === 'week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
  } else if (kind === 'month') {
    start.setDate(1)
  }
  return { from: start.getTime(), to: Date.now() }
}

/**
 * 汇总统计
 * @returns { revenue, recharge, cardSold, verifyCount, recordCount }
 */
function summary(kind) {
  const { from, to } = rangeOf(kind || 'month')
  const list = store
    .all('records')
    .filter((r) => (r.createdAt || 0) >= from && (r.createdAt || 0) <= to)

  let revenue = 0
  let rechargeAmt = 0
  let cardSold = 0
  let verifyCount = 0

  list.forEach((r) => {
    if (r.type === 'consume') {
      revenue += r.amount || 0
      verifyCount++
    } else if (r.type === 'recharge') {
      rechargeAmt += r.amount || 0
    } else if (r.type === 'cardbuy') {
      cardSold++
      revenue += r.amount || 0
    } else if (r.type === 'cardverify') {
      verifyCount++
    }
  })

  return {
    revenue,
    revenueText: moneyShort(revenue),
    recharge: rechargeAmt,
    rechargeText: moneyShort(rechargeAmt),
    cardSold,
    verifyCount,
    recordCount: list.length
  }
}

/** 按天分组的营业额，用于趋势柱状图 */
function dailyRevenue(kind, buckets) {
  const { from, to } = rangeOf(kind || 'month')
  const n = buckets || 4
  const span = Math.max(1, Math.ceil((to - from) / n))
  const out = []

  for (let i = 0; i < n; i++) {
    const s = from + i * span
    const e = i === n - 1 ? to : s + span
    const total = store
      .all('records')
      .filter(
        (r) =>
          (r.type === 'consume' || r.type === 'cardbuy') &&
          (r.createdAt || 0) >= s &&
          (r.createdAt || 0) <= e
      )
      .reduce((sum, r) => sum + (r.amount || 0), 0)
    out.push({
      label: md(s) + '-' + md(e).split('-')[1],
      value: total,
      height: 0 // 由页面按最大值算百分比
    })
  }

  const max = Math.max.apply(
    null,
    out.map((o) => o.value).concat([1])
  )
  out.forEach((o) => {
    o.height = Math.round((o.value / max) * 100)
    o.valueText = moneyShort(o.value)
  })
  return out
}

/** 首页工作台的今日概览 */
function todayOverview() {
  const s = summary('day')
  const members = store.all('members')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()

  const newMembers = members.filter((m) => (m.joinedAt || 0) >= todayTs).length
  const sleeping = members.filter((m) => m.status === 'sleeping').length

  // 生日：按月日匹配
  const mmdd =
    String(new Date().getMonth() + 1).padStart(2, '0') +
    '-' +
    String(new Date().getDate()).padStart(2, '0')
  const birthday = members.filter(
    (m) => m.birthday && m.birthday.slice(5) === mmdd
  ).length

  // 次卡 30 天内到期
  const soon = Date.now() + 30 * 86400000
  const expiring = store
    .all('memberCards')
    .filter((c) => c.status === 'active' && c.expireAt && c.expireAt <= soon).length

  // 较昨日营收变化（口径与 summary 一致：消费 + 购卡）
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayTs = yesterday.getTime()
  const yesterdayRevenue = store
    .all('records')
    .filter(
      (r) =>
        (r.createdAt || 0) >= yesterdayTs &&
        (r.createdAt || 0) < todayTs &&
        (r.type === 'consume' || r.type === 'cardbuy')
    )
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  let compareText = '较昨日 --'
  let compareUp = true
  if (yesterdayRevenue > 0) {
    const pct = Math.round(((s.revenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10
    compareUp = pct >= 0
    compareText = '较昨日 ' + Math.abs(pct).toFixed(1) + '%'
  } else if (s.revenue > 0) {
    compareText = '较昨日 新增'
  }

  return {
    compareText,
    compareUp,
    revenueText: s.revenueText,
    rechargeText: s.rechargeText,
    verifyCount: s.verifyCount,
    newMembers,
    birthday,
    sleeping,
    expiring,
    totalMembers: members.length,
    updatedText: mdhm(Date.now())
  }
}

/* ------------------------------ 同步包装 ------------------------------ */

/** 页面 onShow 时调：读本地 + 后台尝试同步 */
function refresh() {
  sync.bindNetwork()
  sync.autoSync()
  return sync.status()
}

module.exports = {
  // 格式化
  money,
  moneyShort,
  toFen,
  maskPhone,
  prettyPhone,
  md,
  mdhm,
  ymd,
  relativeDay,
  // 配置
  levels,
  levelById,
  levelName,
  levelBadge,
  config,
  cardTypes,
  services,
  // 会员
  listMembers,
  memberRow,
  memberById,
  findMember,
  findMembersBySuffix,
  createMember,
  updateMember,
  disableMember,
  // 次卡
  cardsOf,
  cardRow,
  // 储值
  calcRechargeGift,
  recharge,
  buyCard,
  // 核销
  consume,
  verifyCard,
  // 流水
  records,
  recordRow,
  RECORD_META,
  // 统计
  rangeOf,
  summary,
  dailyRevenue,
  todayOverview,
  // 同步
  refresh,
  syncStatus: () => sync.status(),
  syncNow: () => sync.sync({ force: false }),
  syncFull: () => sync.sync({ force: true })
}
