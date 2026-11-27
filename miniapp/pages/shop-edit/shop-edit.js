const app = getApp()
const biz = require('../../utils/biz')
const store = require('../../utils/store')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    inputs: {
      shopName: '',
      address: '',
      manager: '',
      phone: ''
    }
  },

  onShow() {
    app.applyTheme(this)
    this.loadData()
  },

  loadData() {
    const cfg = biz.config()
    this.setData({
      inputs: {
        shopName: cfg.shopName || '',
        address: cfg.address || '',
        manager: cfg.manager || '',
        phone: cfg.phone || ''
      }
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ ['inputs.' + key]: e.detail.value })
  },

  cancel() {
    wx.navigateBack()
  },

  save() {
    const inputs = this.data.inputs
    const shopName = (inputs.shopName || '').trim()
    if (!shopName) {
      wx.showToast({ title: '请输入店铺名称', icon: 'none' })
      return
    }

    store.patch('config', 'shop', {
      shopName,
      address: (inputs.address || '').trim(),
      manager: (inputs.manager || '').trim(),
      phone: (inputs.phone || '').trim()
    })

    wx.showToast({ title: '已保存', icon: 'success' })
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.navigateBack()
    }, 600)
  }
})
