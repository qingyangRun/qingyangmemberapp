const app = getApp()
const biz = require('../../utils/biz')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'stats',

    period: 'month',
    periodName: '本月',
    rangeText: '',
    compareText: '',
    syncText: '实时',

    revenueText: '0',
    rechargeText: '0',
    cardSold: 0,
    verifyCount: 0,

    revenueDiff: 0,
    revenueDiffText: '0%',
    rechargeDiff: 0,
    rechargeDiffText: '0%',
    cardSoldDiff: 0,
    cardSoldDiffText: '0%',
    verifyDiff: 0,
    verifyDiffText: '0%',

    bars: [],
    avgText: '0',

    balanceRevenueText: '0',
    cardRevenueText: '0',
    balancePercent: 0,
    cardPercent: 0,

    topMembers: [],

    levelFilterText: '全部等级',
    statusFilterText: '全部状态',
    tagFilterText: '全部标记',

    footNote: '统计不含已退款记录；切换日 / 周 / 月即按对应周期重新计算。'
  },

  onLoad(options) {
    const st = (options && options.state) || ''
    const valid = ['day', 'week', 'month']
    this.setData({ period: valid.indexOf(st) >= 0 ? st : 'month' })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 'stats', theme: app.globalData.theme })
    this.loadData()
    biz.refresh()
    setTimeout(() => {
      const s = biz.syncStatus()
      this.setData({
        syncText: s.mode === 'cloud' ? '实时' : '本地',
        footNote:
          s.mode === 'cloud'
            ? '统计不含已退款记录；切换日 / 周 / 月即按对应周期重新计算。'
            : '当前为本地数据统计；接入云开发后会自动合并多端数据。'
      })
    }, 800)
  },

  onPullDownRefresh() {
    biz.syncNow().then(() => {
      this.loadData()
      wx.stopPullDownRefresh()
    })
  },

  pickPeriod(e) {
    this.setData({ period: e.currentTarget.dataset.period })
    this.loadData()
  },

  /* ------------------------------ 周期计算 ------------------------------ */

  /** 返回当期与上一期的起止时间 */
  periods(kind) {
    const now = new Date()
    let start
    let prevStart
    let prevEnd

    if (kind === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      prevStart = new Date(start.getTime() - 86400000)
      prevEnd = new Date(start.getTime() - 1)
    } else if (kind === 'week') {
      const day = now.getDay() || 7
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
      prevStart = new Date(start.getTime() - 7 * 86400000)
      prevEnd = new Date(start.getTime() - 1)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      prevEnd = new Date(start.getTime() - 1)
    }

    return {
      from: start.getTime(),
      to: now.getTime(),
      prevFrom: prevStart.getTime(),
      prevTo: prevEnd.getTime(),
      start
    }
  },

  /** 一段时间的汇总 */
  sumOf(from, to) {
    const list = biz
      .records({ from })
      .filter((r) => (r.createdAt || 0) <= to)

    let revenue = 0
    let recharge = 0
    let cardSold = 0
    let verify = 0
    let balanceRev = 0
    let cardRev = 0

    list.forEach((r) => {
      if (r.type === 'consume') {
        revenue += r.amount || 0
        balanceRev += r.amount || 0
        verify++
      } else if (r.type === 'recharge') {
        recharge += r.amount || 0
      } else if (r.type === 'cardbuy') {
        cardSold++
        revenue += r.amount || 0
        cardRev += r.amount || 0
      } else if (r.type === 'cardverify') {
        verify++
      }
    })

    return { revenue, recharge, cardSold, verify, balanceRev, cardRev, count: list.length }
  },

  /** 环比百分比 */
  diff(cur, prev) {
    if (!prev) return cur > 0 ? 100 : 0
    return Math.round(((cur - prev) / prev) * 1000) / 10
  },

  diffText(v) {
    return (v >= 0 ? '+' : '') + v + '%'
  },

  /* ------------------------------ 主流程 ------------------------------ */

  loadData() {
    const d = this.data
    const p = this.periods(d.period)
    const cur = this.sumOf(p.from, p.to)
    const prev = this.sumOf(p.prevFrom, p.prevTo)

    const rd = this.diff(cur.revenue, prev.revenue)
    const cd = this.diff(cur.recharge, prev.recharge)
    const sd = this.diff(cur.cardSold, prev.cardSold)
    const vd = this.diff(cur.verify, prev.verify)

    // 趋势柱：日按小时，周按天，月按周
    const bars = this.buildBars(d.period, p)

    // 日均
    const days =
      d.period === 'day'
        ? 1
        : d.period === 'week'
        ? 7
        : new Date(p.start.getFullYear(), p.start.getMonth() + 1, 0).getDate()
    const avg = Math.round(cur.revenue / 100 / days)

    // 消费构成
    const totalRev = cur.revenue || 1
    const bp = Math.round((cur.balanceRev / totalRev) * 100)
    const cp = 100 - bp

    this.setData({
      periodName: d.period === 'day' ? '今日' : d.period === 'week' ? '本周' : '本月',
      rangeText: this.rangeText(d.period, p),
      compareText:
        d.period === 'day' ? '对比昨日' : d.period === 'week' ? '对比上周' : '对比上月同期',

      revenueText: biz.moneyShort(cur.revenue),
      rechargeText: biz.moneyShort(cur.recharge),
      cardSold: cur.cardSold,
      verifyCount: cur.verify,

      revenueDiff: rd,
      revenueDiffText: this.diffText(rd),
      rechargeDiff: cd,
      rechargeDiffText: this.diffText(cd),
      cardSoldDiff: sd,
      cardSoldDiffText: this.diffText(sd),
      verifyDiff: vd,
      verifyDiffText: this.diffText(vd),

      bars,
      avgText: avg.toLocaleString('zh-CN'),

      balanceRevenueText: biz.moneyShort(cur.balanceRev),
      cardRevenueText: biz.moneyShort(cur.cardRev),
      balancePercent: bp,
      cardPercent: cp
    })

    this.loadTop(p.from, p.to)
  },

  rangeText(kind, p) {
    const s = p.start
    const now = new Date()
    if (kind === 'day') {
      return (
        s.getMonth() + 1 + ' 月 ' + s.getDate() + ' 日 ' + WEEK[s.getDay()]
      )
    }
    if (kind === 'week') {
      const end = new Date(s.getTime() + 6 * 86400000)
      return biz.md(s.getTime()) + ' 至 ' + biz.md(end.getTime())
    }
    return (
      biz.md(s.getTime()) + ' 至 ' + (now.getMonth() + 1) + '-' + now.getDate()
    )
  },

  /** 趋势柱：不同周期不同粒度 */
  buildBars(kind, p) {
    const out = []
    const recs = biz.records({ from: p.from }).filter((r) =>
      ['consume', 'cardbuy'].includes(r.type)
    )

    if (kind === 'day') {
      // 按 2 小时分段，营业时段 9-21 点
      for (let h = 9; h <= 21; h += 2) {
        const s = new Date(p.start.getTime() + h * 3600000).getTime()
        const e = s + 2 * 3600000
        const v = recs
          .filter((r) => r.createdAt >= s && r.createdAt < e)
          .reduce((a, r) => a + (r.amount || 0), 0)
        out.push({ label: String(h).padStart(2, '0'), value: v })
      }
    } else if (kind === 'week') {
      for (let i = 0; i < 7; i++) {
        const s = p.start.getTime() + i * 86400000
        const e = s + 86400000
        const v = recs
          .filter((r) => r.createdAt >= s && r.createdAt < e)
          .reduce((a, r) => a + (r.amount || 0), 0)
        out.push({ label: WEEK[(p.start.getDay() + i) % 7], value: v })
      }
    } else {
      // 按月分成 4 段
      const daysInMonth = new Date(
        p.start.getFullYear(),
        p.start.getMonth() + 1,
        0
      ).getDate()
      const span = Math.ceil(daysInMonth / 4)
      for (let i = 0; i < 4; i++) {
        const s = new Date(
          p.start.getFullYear(),
          p.start.getMonth(),
          1 + i * span
        ).getTime()
        const e = s + span * 86400000
        const v = recs
          .filter((r) => r.createdAt >= s && r.createdAt < e)
          .reduce((a, r) => a + (r.amount || 0), 0)
        out.push({
          label:
            p.start.getMonth() +
            1 +
            '/' +
            (1 + i * span) +
            '-' +
            Math.min(daysInMonth, i * span + span),
          value: v
        })
      }
    }

    const max = Math.max.apply(null, out.map((o) => o.value).concat([1]))
    const lastIdx = out.length - 1
    out.forEach((o, i) => {
      o.height = o.value > 0 ? Math.max(6, Math.round((o.value / max) * 100)) : 3
      o.hot = i === lastIdx
    })
    return out
  },

  /** 会员贡献 Top 3 */
  loadTop(from, to) {
    const list = biz.records({ from }).filter((r) => (r.createdAt || 0) <= to)

    const map = new Map()
    list.forEach((r) => {
      if (r.type !== 'consume' && r.type !== 'cardbuy') return
      const cur = map.get(r.memberId) || { amount: 0, visits: 0 }
      cur.amount += r.amount || 0
      cur.visits++
      map.set(r.memberId, cur)
    })

    const arr = Array.from(map.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 3)

    const max = arr.length ? arr[0][1].amount || 1 : 1

    const top = arr.map(([id, v], i) => {
      const m = biz.memberById(id) || {}
      return {
        id,
        rank: i + 1,
        isTop: true,
        name: m.name || '未知',
        initial: (m.name || '?').slice(0, 1),
        levelName: biz.levelName(m.levelId),
        levelBadge: biz.levelBadge(m.levelId),
        avaClass:
          m.levelId === 'level-black'
            ? 'dark'
            : m.levelId === 'level-gold'
            ? 'gold'
            : m.levelId === 'level-silver'
            ? ''
            : 'gray',
        visitText: v.visits + ' 次消费',
        consumeText: biz.moneyShort(m.totalConsume || 0),
        amountText: biz.moneyShort(v.amount),
        percent: Math.round((v.amount / max) * 100)
      }
    })

    this.setData({ topMembers: top })
  },

  /* ------------------------------ 交互 ------------------------------ */

  openMember(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/member-detail/member-detail?id=' + id })
  },

  openMemberFilter() {
    // members 是 tabBar 页，navigateTo 会失败且 switchTab 不支持 query
    app.globalData.pendingMembersState = 'filter'
    wx.switchTab({ url: '/pages/members/members' })
  },

  go(e) {
    const ds = e.currentTarget.dataset
    const target = ds.page
    if (!target) return
    const routes = {
      home: 'pages/index/index',
      members: 'pages/members/members',
      records: 'pages/records/records',
      stats: 'pages/stats/stats',
      settings: 'pages/settings/settings',
      'member-detail': 'pages/member-detail/member-detail',
      'member-new': 'pages/member-new/member-new',
      'member-edit': 'pages/member-edit/member-edit',
      verify: 'pages/verify/verify',
      recharge: 'pages/recharge/recharge',
      levels: 'pages/levels/levels',
      points: 'pages/points/points',
      cards: 'pages/cards/cards',
      theme: 'pages/theme/theme'
    }
    const url = routes[target]
    if (!url) return
    const tabs = ['home', 'members', 'records', 'stats', 'settings']
    if (tabs.indexOf(target) >= 0) {
      wx.switchTab({ url: '/' + url })
    } else {
      wx.navigateTo({
        url: '/' + url + (ds.state ? '?state=' + ds.state : '')
      })
    }
  },

  setState(e) {
    this.setData({ state: e.currentTarget.dataset.state })
  }
})
