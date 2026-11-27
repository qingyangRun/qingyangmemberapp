const app = getApp()
const biz = require('../../utils/biz')
const store = require('../../utils/store')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    list: [],
    onSaleCount: 0,
    soldAll: 0,
    verifiedAll: 0,

    editing: '',
    editName: '',
    editPrice: '',
    editTimes: '',
    editValidDays: '365',
    editOnSale: true,
    editUnitPrice: '0.0',
    editPoints: 0
  },

  onLoad(options) {
    const st = (options && options.state) || ''
    this.setData({ state: st === 'edit' ? 'edit' : 'default' })
  },

  onShow() {
    app.applyTheme(this)
    this.loadData()
  },

  loadData() {
    const types = store.all('cardTypes')
    const memberCards = store.all('memberCards')
    const cfg = biz.config()
    const rate = (cfg.pointRules && cfg.pointRules.cardbuy) || 0

    const list = types
      .sort((a, b) => (b.sort || 0) - (a.sort || 0))
      .map((c) => {
        const mine = memberCards.filter((mc) => mc.cardTypeId === c._id)
        const sold = mine.length
        const verified = mine.reduce((s, mc) => s + (mc.used || 0), 0)
        return {
          id: c._id,
          name: c.name,
          times: c.times,
          price: c.price,
          priceText: biz.moneyShort(c.price),
          unitPrice: (c.price / 100 / c.times).toFixed(1),
          validDays: c.validDays || 365,
          onSale: c.onSale !== false,
          sold,
          verified
        }
      })

    this.setData({
      list,
      onSaleCount: list.filter((x) => x.onSale).length,
      soldAll: list.reduce((s, x) => s + x.sold, 0),
      verifiedAll: list.reduce((s, x) => s + x.verified, 0)
    })

    this.setData({ cardbuyRate: rate })
  },

  /* ------------------------------ 编辑 ------------------------------ */

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    const c = store.findById('cardTypes', id)
    if (!c) return

    this.setData({
      state: 'edit',
      editing: id,
      editName: c.name,
      editPrice: String(c.price / 100),
      editTimes: String(c.times),
      editValidDays: String(c.validDays || 365),
      editOnSale: c.onSale !== false
    })
    this.calcPreview()
  },

  openNew() {
    this.setData({
      state: 'edit',
      editing: '',
      editName: '',
      editPrice: '',
      editTimes: '',
      editValidDays: '365',
      editOnSale: true
    })
    this.calcPreview()
  },

  closeEdit() {
    this.setData({ state: 'default', editing: '' })
  },

  onEditInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
    this.calcPreview()
  },

  toggleOnSale() {
    this.setData({ editOnSale: !this.data.editOnSale })
  },

  calcPreview() {
    const price = biz.toFen(this.data.editPrice || 0)
    const times = parseInt(this.data.editTimes, 10) || 0
    const rate = (biz.config().pointRules || {}).cardbuy || 0

    this.setData({
      editUnitPrice: times ? (price / 100 / times).toFixed(1) : '0.0',
      editPoints: Math.floor((price / 100) * rate)
    })
  },

  saveEdit() {
    const name = (this.data.editName || '').trim()
    const price = biz.toFen(this.data.editPrice || 0)
    const times = parseInt(this.data.editTimes, 10) || 0

    if (!name) {
      wx.showToast({ title: '请输入项目名称', icon: 'none' })
      return
    }
    if (price <= 0) {
      wx.showToast({ title: '请输入售价', icon: 'none' })
      return
    }
    if (times <= 0) {
      wx.showToast({ title: '请输入可用次数', icon: 'none' })
      return
    }

    const patch = {
      name,
      price,
      times,
      validDays: parseInt(this.data.editValidDays, 10) || 365,
      onSale: this.data.editOnSale
    }

    if (this.data.editing) {
      store.patch('cardTypes', this.data.editing, patch)
    } else {
      store.put(
        'cardTypes',
        Object.assign({}, patch, {
          _id: store.uid('ct'),
          sort: store.all('cardTypes').length + 1
        })
      )
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    biz.syncNow().catch(() => {})
    this.setData({ state: 'default', editing: '' })
    this.loadData()
  },

  removeItem() {
    const id = this.data.editing
    if (!id) return

    // 已经有人买过就只下架，不真删（保护历史次卡）
    const sold = store
      .all('memberCards')
      .filter((mc) => mc.cardTypeId === id).length

    if (sold > 0) {
      wx.showModal({
        title: '已有会员购买',
        content:
          '该项目已被 ' + sold + ' 位会员购买，不能删除。可以选择下架，已购次卡继续可用。',
        confirmText: '下架',
        success: (res) => {
          if (!res.confirm) return
          store.patch('cardTypes', id, { onSale: false })
          biz.syncNow().catch(() => {})
          this.setData({ state: 'default', editing: '' })
          this.loadData()
          wx.showToast({ title: '已下架', icon: 'success' })
        }
      })
      return
    }

    store.remove('cardTypes', id)
    biz.syncNow().catch(() => {})
    this.setData({ state: 'default', editing: '' })
    this.loadData()
    wx.showToast({ title: '已删除', icon: 'success' })
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
