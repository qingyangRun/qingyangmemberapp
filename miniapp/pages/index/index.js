const app = getApp()
const biz = require('../../utils/biz')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'index',

    compareText: '较昨日 --',
    compareUp: true,
    revenueInt: '0',
    revenueDec: '00',
    rechargeText: '0',
    verifyCount: 0,
    newMembers: 0,
    dateText: '',
    updatedText: '',

    birthday: 0,
    sleeping: 0,
    expiring: 0,

    feed: [],

    syncMode: 'local',
    syncText: '本地存储',
    syncFootText: '数据保存在本机，点这里试试同步云端'
  },

  onLoad(options) {
    const state = options && options.state
    const states = ['default']
    this.setData({ state: states.indexOf(state) >= 0 ? state : 'default' })
  },

  onShow() {
    app.applyTheme(this)
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 'index', theme: app.globalData.theme })
    this.loadData()
    biz.refresh()
    setTimeout(() => this.loadSyncState(), 900)
  },

  onPullDownRefresh() {
    this.setData({ syncFootText: '正在同步…' })
    biz
      .syncNow()
      .then((r) => {
        this.loadData()
        this.loadSyncState()
        wx.stopPullDownRefresh()
        wx.showToast({
          title: r.ok ? '同步完成' : '已保存到本地',
          icon: 'none'
        })
      })
      .catch(() => {
        wx.stopPullDownRefresh()
        this.loadSyncState()
      })
  },

  /* ------------------------------ 数据 ------------------------------ */

  loadData() {
    const o = biz.todayOverview()

    // 金额拆成整数和小数两段，方便排版（设计稿 ¥3,286.50 的写法）
    const parts = String(o.revenueText).split('.')
    const now = new Date()

    const feed = biz
      .records({})
      .slice(0, 4)
      .map((r) => {
        const row = biz.recordRow(r)
        const m = biz.memberById(r.memberId)
        return Object.assign(row, {
          initial: ((m && m.name) || '?').slice(0, 1),
          avaClass:
            r.type === 'recharge'
              ? 'gold'
              : r.type === 'cardverify'
              ? 'teal'
              : r.type === 'cardbuy'
              ? 'gray'
              : '',
          actionText:
            r.type === 'recharge'
              ? '充值'
              : r.type === 'cardbuy'
              ? '购卡'
              : r.type === 'cardverify'
              ? '核销次卡'
              : '消费',
          subText: row.timeText + ' · ' + row.typeName,
          amountCls: r.type === 'recharge' ? 'in' : ''
        })
      })

    this.setData({
      compareText: o.compareText,
      compareUp: o.compareUp,
      revenueInt: parts[0] || '0',
      revenueDec: parts[1] || '00',
      rechargeText: o.rechargeText,
      verifyCount: o.verifyCount,
      newMembers: o.newMembers,
      birthday: o.birthday,
      sleeping: o.sleeping,
      expiring: o.expiring,
      dateText:
        now.getMonth() + 1 + ' 月 ' + now.getDate() + ' 日 ' + WEEK[now.getDay()],
      updatedText: o.updatedText,
      feed
    })
  },

  loadSyncState() {
    const s = biz.syncStatus()
    const isCloud = s.mode === 'cloud'

    let foot = '数据保存在本机'
    if (isCloud) {
      foot = s.lastSyncAt
        ? '已同步云端 · ' + biz.mdhm(s.lastSyncAt)
        : '已连接云端'
    } else if (!s.online) {
      foot = '当前离线，数据已存本机'
    }
    if (s.pending > 0) {
      foot += ' · ' + s.pending + ' 项待同步'
    }

    this.setData({
      syncMode: s.mode,
      syncText: isCloud ? '已同步' : '本地',
      syncFootText: foot
    })
  },

  /** 点底部状态可以手动触发一次同步 */
  onSyncTap() {
    if (this.data.syncMode === 'cloud') {
      wx.showToast({ title: '刚刚同步过', icon: 'none' })
      return
    }
    this.setData({ syncFootText: '正在尝试连接云端…' })
    biz.syncNow().then((r) => {
      this.loadData()
      this.loadSyncState()
      wx.showToast({
        title: r.ok ? '已同步云端' : '云端不可用，已存本机',
        icon: 'none'
      })
    })
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id
    const rec = biz.records({}).find((r) => r._id === id)
    if (rec) {
      wx.navigateTo({
        url: '/pages/member-detail/member-detail?id=' + rec.memberId
      })
    }
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
      if (target === 'members' && ds.state === 'filter') {
        app.globalData.pendingMembersState = 'filter'
      }
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
