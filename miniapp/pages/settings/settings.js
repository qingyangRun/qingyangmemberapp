const app = getApp()
const biz = require('../../utils/biz')
const sync = require('../../utils/sync')
const store = require('../../utils/store')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'settings',

    shop: {},
    memberCount: 0,
    levelCount: 0,
    cardCount: 0,
    recordCount: 0,

    // 同步状态
    syncMode: 'local',
    syncTitle: '本地存储',
    syncDesc: '',
    syncDot: 'gray',
    syncing: false,
    pending: 0,
    lastSyncText: '从未同步',
    online: true,

    themeName: '经典蓝'
  },

  onLoad(options) {
    const state = options && options.state
    const states = ['default']
    this.setData({ state: states.indexOf(state) >= 0 ? state : 'default' })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 'settings', theme: app.globalData.theme })
    this.loadData()
    setTimeout(() => this.loadSync(), 700)
  },

  loadData() {
    const cfg = biz.config()
    const members = store.all('members')
    const themeNames = {
      blue: '经典蓝',
      green: '清样绿',
      violet: '雅紫',
      orange: '琥珀橙',
      rose: '玫瑰红',
      graphite: '石墨黑'
    }

    this.setData({
      shop: {
        name: cfg.shopName || '清样造型',
        branch: cfg.branch || '',
        address: cfg.address || '',
        manager: cfg.manager || '',
        phone: biz.prettyPhone(cfg.phone || ''),
        shopNo: cfg.shopNo || ''
      },
      memberCount: members.length,
      levelCount: biz.levels().length,
      cardCount: biz.cardTypes().filter((c) => c.onSale !== false).length,
      recordCount: store.all('records').length,
      themeName: themeNames[app.globalData.theme] || '经典蓝'
    })
  },

  loadSync() {
    const s = biz.syncStatus()
    const isCloud = s.mode === 'cloud'

    let title = '本地存储'
    let desc = '数据保存在本机微信里，卸载小程序会丢失。填好云环境 ID 后自动开启云端备份。'
    let dot = 'gray'

    if (isCloud) {
      title = '已连接云端'
      desc = '本机修改会先存本地，再自动同步到云数据库。'
      dot = 'green'
    } else if (!s.online) {
      title = '离线中'
      desc = '当前没有网络，修改会先存本机，联网后自动补同步。'
      dot = 'warn'
    } else if (s.lastError) {
      title = '云端不可用'
      desc = s.lastError + '。界面照常使用，数据存在本机。'
      dot = 'warn'
    }

    this.setData({
      syncMode: s.mode,
      syncTitle: title,
      syncDesc: desc,
      syncDot: dot,
      syncing: s.syncing,
      pending: s.pending,
      online: s.online,
      lastSyncText: s.lastSyncAt
        ? biz.mdhm(s.lastSyncAt) + ' 同步'
        : '从未同步'
    })
  },

  /** 手动同步 */
  doSync() {
    if (this.data.syncing) return
    this.setData({ syncing: true })

    sync
      .sync()
      .then((r) => {
        this.loadSync()
        if (r.ok) {
          wx.showToast({ title: '同步完成', icon: 'success' })
        } else {
          wx.showModal({
            title: '云端不可用',
            content:
              (r.msg || '连接失败') +
              '\n\n数据已经保存在本机，功能不受影响。',
            showCancel: false
          })
        }
      })
      .catch(() => {
        this.loadSync()
        wx.showToast({ title: '同步失败，已存本机', icon: 'none' })
      })
  },

  /** 重新探测云环境 */
  retryCloud() {
    sync.recheck()
    this.doSync()
  },

  /** 清空本地数据（危险操作，二次确认） */
  clearLocal() {
    wx.showModal({
      title: '清空本地数据',
      content:
        '会删除本机保存的会员、次卡和流水，且不可恢复。云端数据不受影响，下次同步会重新拉回来。',
      confirmText: '继续',
      confirmColor: '#C0342B',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '再确认一次',
          content: '真的要清空吗？',
          confirmText: '确认清空',
          confirmColor: '#C0342B',
          success: (r2) => {
            if (!r2.confirm) return
            store.resetAll()
            this.loadData()
            this.loadSync()
            wx.showToast({ title: '已清空', icon: 'success' })
          }
        })
      }
    })
  },

  /** 恢复示例数据 */
  reseed() {
    wx.showModal({
      title: '恢复示例数据',
      content: '会清空本地并重新灌入一套演示数据，用于试用界面。',
      success: (res) => {
        if (!res.confirm) return
        store.resetAll()
        require('../../utils/seed').seed()
        this.loadData()
        this.loadSync()
        wx.showToast({ title: '已恢复', icon: 'success' })
      }
    })
  },

  goTheme() {
    wx.navigateTo({ url: '/pages/theme/theme' })
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
