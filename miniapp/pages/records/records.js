const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'records',

    type: '',
    monthOffset: 0,
    monthText: '',
    rangeText: '',
    memberText: '全部会员',

    sumIncomeText: '0',
    sumConsumeText: '0',
    sumCount: 0,

    list: []
  },

  onLoad(options) {
    const state = options && options.state
    const types = ['recharge', 'consume', 'cardbuy', 'cardverify']
    const st = types.indexOf(state) >= 0 ? state : ''
    this.setData({ type: st })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 'records', theme: app.globalData.theme })
    this.loadData()
    biz.refresh()
  },

  onPullDownRefresh() {
    biz.syncNow().then(() => {
      this.loadData()
      wx.stopPullDownRefresh()
    })
  },

  /* ------------------------------ 月份切换 ------------------------------ */

  monthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() + this.data.monthOffset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start: start.getTime(), end: end.getTime(), startDate: start }
  },

  prevMonth() {
    this.setData({ monthOffset: this.data.monthOffset - 1 })
    this.loadData()
  },

  nextMonth() {
    if (this.data.monthOffset >= 0) return // 不往未来翻
    this.setData({ monthOffset: this.data.monthOffset + 1 })
    this.loadData()
  },

  pickType(e) {
    this.setData({ type: e.currentTarget.dataset.type || '' })
    this.loadData()
  },

  /* ------------------------------ 数据 ------------------------------ */

  loadData() {
    const { start, end, startDate } = this.monthRange()
    const d = this.data

    const rows = biz.records({ type: d.type, from: start, to: end })
    const allMonth = biz.records({ from: start, to: end })

    // 汇总
    let income = 0
    let consume = 0
    allMonth.forEach((r) => {
      if (r.type === 'recharge') income += r.amount || 0
      if (r.type === 'consume') consume += r.amount || 0
      if (r.type === 'cardbuy') income += r.amount || 0
    })

    const list = rows.map((r) => {
      const row = biz.recordRow(r)
      return Object.assign(row, {
        memberId: r.memberId,
        subText: row.timeText + ' · ' + (row.remark || row.typeName)
      })
    })

    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)

    this.setData({
      monthText: startDate.getFullYear() + ' 年 ' + (startDate.getMonth() + 1) + ' 月',
      rangeText: biz.md(start) + ' 至 ' + biz.md(monthEnd),
      sumIncomeText: biz.moneyShort(income),
      sumConsumeText: biz.moneyShort(consume),
      sumCount: allMonth.length,
      list
    })
  },

  openMember(e) {
    const id = e.currentTarget.dataset.member
    if (!id) return
    wx.navigateTo({ url: '/pages/member-detail/member-detail?id=' + id })
  },

  /* ------------------------------ 跳转 ------------------------------ */

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
