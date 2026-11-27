const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'members',

    // 搜索与筛选
    inputs: { f0: '', f1: '', f2: '' },
    keyword: '',
    levelId: '',
    status: '',
    tags: [],
    pendingTags: [],
    pendingLevel: '',
    balanceMin: null,
    balanceMax: null,

    // 数据
    list: [],
    total: 0,
    totalText: '0',
    newThisMonth: 0,
    sleeping: 0,

    // 选项
    levels: [],
    statusOptions: [
      { value: '', label: '全部' },
      { value: 'normal', label: '正常' },
      { value: 'sleeping', label: '沉睡' },
      { value: 'disabled', label: '停用' }
    ],
    tagOptions: ['高复购', '生日月', '敏感头皮', '只做烫染', '转介绍', '沉睡唤醒'],

    // 同步状态
    syncMode: 'local',
    syncText: '本地存储'
  },

  onLoad(options) {
    const state = options && options.state
    const states = ['default', 'filter']
    this.setData({
      state: states.indexOf(state) >= 0 ? state : 'default'
    })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 'members', theme: app.globalData.theme })
    if (app.globalData.pendingMembersState) {
      this.setData({ state: app.globalData.pendingMembersState })
      app.globalData.pendingMembersState = ''
    }
    this.loadData()
    // 后台尝试同步；没网或没云环境时静默降级，不影响界面
    biz.refresh()
    setTimeout(() => this.refreshSyncBadge(), 800)
  },

  refreshSyncBadge() {
    const s = biz.syncStatus()
    this.setData({
      syncMode: s.mode,
      syncText: s.mode === 'cloud' ? '已同步云端' : '本地存储'
    })
  },

  /* ------------------------------ 读取 ------------------------------ */

  loadData() {
    const d = this.data

    const list = biz.listMembers({
      keyword: d.keyword,
      levelId: d.levelId,
      status: d.status,
      tags: d.tags,
      balanceMin: d.balanceMin,
      balanceMax: d.balanceMax
    })

    const rows = list.map(biz.memberRow)

    // 顶部统计
    const all = biz.listMembers({})
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const newThisMonth = all.filter(
      (m) => (m.joinedAt || 0) >= monthStart.getTime()
    ).length
    const sleeping = all.filter((m) => m.status === 'sleeping').length

    this.setData({
      list: rows,
      total: rows.length,
      totalText: rows.length.toLocaleString('zh-CN'),
      newThisMonth,
      sleeping,
      levels: biz.levels().map((l) => ({
        id: l._id,
        name: l.name,
        active: l._id === d.levelId
      }))
    })
  },

  /* ------------------------------ 交互 ------------------------------ */

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['inputs.' + key]: e.detail.value })
  },

  /** 搜索框回车 / 点查询 */
  onSearch() {
    this.setData({ keyword: this.data.inputs.f0 || '' })
    this.loadData()
  },

  onSearchClear() {
    this.setData({ 'inputs.f0': '', keyword: '' })
    this.loadData()
  },

  /** 点击会员进入详情 */
  openMember(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/member-detail/member-detail?id=' + id })
  },

  /* ------------------------------ 筛选面板 ------------------------------ */

  openFilter() {
    this.setData({
      state: 'filter',
      pendingTags: this.data.tags.slice(),
      pendingLevel: this.data.levelId
    })
  },

  closeFilter() {
    this.setData({ state: 'default' })
  },

  pickLevel(e) {
    const v = e.currentTarget.dataset.value || ''
    this.setData({ pendingLevel: v })
  },

  pickStatus(e) {
    this.setData({ status: e.currentTarget.dataset.value || '' })
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const list = this.data.pendingTags.slice()
    const i = list.indexOf(tag)
    if (i >= 0) list.splice(i, 1)
    else list.push(tag)
    this.setData({ pendingTags: list })
  },

  /** 余额区间：输入的是「元」，转成「分」 */
  applyRange() {
    const min = this.data.inputs.f1
    const max = this.data.inputs.f2
    this.setData({
      balanceMin: min ? biz.toFen(min) : null,
      balanceMax: max ? biz.toFen(max) : null
    })
  },

  confirmFilter() {
    this.setData({
      levelId: this.data.pendingLevel,
      tags: this.data.pendingTags,
      state: 'default'
    })
    this.applyRange()
    this.loadData()
  },

  resetFilter() {
    this.setData({
      keyword: '',
      levelId: '',
      status: '',
      tags: [],
      pendingTags: [],
      pendingLevel: '',
      balanceMin: null,
      balanceMax: null,
      inputs: { f0: '', f1: '', f2: '' }
    })
    this.loadData()
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
    const s = e.currentTarget.dataset.state
    if (s === 'filter') {
      this.openFilter()
    } else {
      this.setData({ state: 'default' })
    }
  }
})
