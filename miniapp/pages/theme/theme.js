const app = getApp()
const biz = require('../../utils/biz')
const store = require('../../utils/store')

const THEMES = [
  { id: 'blue', name: '经典蓝', desc: '默认 · 专业稳重', main: '#2457F5', soft: '#EBF0FF' },
  { id: 'green', name: '清样绿', desc: '贴合店名 · 温和自然', main: '#0F7A5A', soft: '#E6F4EF' },
  { id: 'violet', name: '雅紫', desc: '偏美业 · 细腻有质感', main: '#5B3FD1', soft: '#EEEAFB' },
  { id: 'orange', name: '琥珀橙', desc: '温暖亲切 · 亲和力强', main: '#BF5A14', soft: '#FDF0E4' },
  { id: 'rose', name: '玫瑰红', desc: '女性客群 · 明快醒目', main: '#BF3566', soft: '#FCE9F0' },
  { id: 'graphite', name: '石墨黑', desc: '克制高级 · 突出内容', main: '#2B3A52', soft: '#EAEEF5' }
]

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: 'theme',
    themes: THEMES,
    syncHint: '全店生效',
    previewCumulative: '0',
    previewTarget: '0',
    previewPercent: 0
  },

  onLoad(options) {
    const state = options && options.state
    const states = ['default']
    this.setData({ state: states.indexOf(state) >= 0 ? state : 'default' })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadPreview()
    const s = biz.syncStatus()
    this.setData({
      syncHint: s.mode === 'cloud' ? '云端同步到所有设备' : '保存在本机'
    })
  },

  /** 预览用的会员：取累计消费最高的那位 */
  loadPreview() {
    const members = biz.listMembers({})
    const top = members.sort(
      (a, b) => (b.totalConsume || 0) - (a.totalConsume || 0)
    )[0]
    if (!top) return

    const ls = biz.levels()
    const cur = ls.find((l) => l._id === top.levelId) || ls[ls.length - 1]
    const idx = ls.indexOf(cur)
    const next = idx > 0 ? ls[idx - 1] : null
    const target = next ? next.consumeThreshold : cur.consumeThreshold || 0
    const current = top.totalConsume || 0

    this.setData({
      previewCumulative: biz.moneyShort(current),
      previewTarget: biz.moneyShort(target),
      previewPercent: target
        ? Math.min(100, Math.round((current / target) * 100))
        : 100
    })
  },

  /** 选主题：先存本地，再尝试同步到云端配置 */
  pickTheme(e) {
    const theme = e.currentTarget.dataset.themeOption || 'blue'
    app.setTheme(theme)
    this.setData({ theme })

    // 主题属于门店配置，写进 config 一起同步
    try {
      store.patch('config', 'shop', { theme })
      biz.syncNow().catch(() => {})
    } catch (err) {}
  },

  resetTheme() {
    app.setTheme('blue')
    this.setData({ theme: 'blue' })
    try {
      store.patch('config', 'shop', { theme: 'blue' })
      biz.syncNow().catch(() => {})
    } catch (err) {}
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
