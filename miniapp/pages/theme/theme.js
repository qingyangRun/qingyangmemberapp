const app = getApp()

Page({
  data: {
    theme: 'blue',
    state: 'default',
    inputs: {},
    selected: 'theme'
  },

  onLoad(options) {
    const state = options && options.state
    const states = ["default"]
    this.setData({
      theme: app.globalData.theme,
      state: states.indexOf(state) >= 0 ? state : 'default'
    })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
  },

  setState(e) {
    this.setData({ state: e.currentTarget.dataset.state })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    const inputs = Object.assign({}, this.data.inputs)
    inputs[key] = e.detail.value
    this.setData({ inputs })
  },

  pickTheme(e) {
    const theme = e.currentTarget.dataset.themeOption || 'blue'
    app.setTheme(theme)
    this.setData({ theme })
  },

  go(e) {
    const ds = e.currentTarget.dataset
    const target = ds.page
    if (!target) return
    const routes = {"home": "pages/index/index", "members": "pages/members/members", "records": "pages/records/records", "stats": "pages/stats/stats", "settings": "pages/settings/settings", "member-detail": "pages/member-detail/member-detail", "member-new": "pages/member-new/member-new", "member-edit": "pages/member-edit/member-edit", "verify": "pages/verify/verify", "recharge": "pages/recharge/recharge", "levels": "pages/levels/levels", "points": "pages/points/points", "cards": "pages/cards/cards", "theme": "pages/theme/theme"}
    const url = routes[target]
    if (!url) return
    const tabs = ["home", "members", "records", "stats", "settings"]
    if (tabs.indexOf(target) >= 0) {
      wx.switchTab({ url: '/' + url })
    } else {
      wx.navigateTo({ url: '/' + url + (ds.state ? '?state=' + ds.state : '') })
    }
  }
})
