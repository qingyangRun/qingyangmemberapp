App({
  globalData: {
    theme: 'blue'
  },

  onLaunch() {
    this.globalData.theme = wx.getStorageSync('qy-theme') || 'blue'
  },

  setTheme(theme) {
    this.globalData.theme = theme || 'blue'
    wx.setStorageSync('qy-theme', this.globalData.theme)
  }
})
