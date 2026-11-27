const app = getApp()
const biz = require('../../utils/biz')
const store = require('../../utils/store')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    levels: [],
    totalMembers: 0,
    goldPlus: 0,
    upgradedThisMonth: 0,

    editing: null,
    editName: '',
    editRecharge: '',
    editConsume: '',
    editDiscount: '',
    editPointRate: ''
  },

  onLoad(options) {
    const st = (options && options.state) || ''
    this.setData({ state: st === 'edit' ? 'edit' : 'default' })
  },

  onShow() {
    app.applyTheme(this)
    this.loadData()
    biz.refresh()
  },

  loadData() {
    const members = store.all('members')
    const ls = biz.levels() // 降序

    // 每个等级下面挂多少会员
    const rows = ls.map((l) => {
      const count = members.filter((m) => m.levelId === l._id).length
      return {
        id: l._id,
        name: l.name,
        sort: l.sort,
        count,
        rechargeThreshold: l.rechargeThreshold || 0,
        consumeThreshold: l.consumeThreshold || 0,
        rechargeText: biz.moneyShort(l.rechargeThreshold || 0),
        consumeText: biz.moneyShort(l.consumeThreshold || 0),
        discount: l.discount || 1,
        discountText: Math.round((l.discount || 1) * 100) / 10 + ' 折',
        pointRate: l.pointRate || 1,
        pointRateText: '积分 ' + (l.pointRate || 1) + ' 倍',
        birthdayGift: !!l.birthdayGift,
        badge:
          l._id === 'level-black'
            ? 'gray'
            : l._id === 'level-gold'
            ? 'gold'
            : l._id === 'level-silver'
            ? 'blue'
            : 'gray',
        top: (l.sort || 0) >= 4
      }
    })

    const goldPlus = members.filter(
      (m) => m.levelId === 'level-gold' || m.levelId === 'level-black'
    ).length

    // 本月升级人数：本月到店且等级在金卡以上的估算
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const upgraded = members.filter(
      (m) =>
        (m.lastVisitAt || 0) >= monthStart.getTime() &&
        (m.levelId === 'level-gold' || m.levelId === 'level-black')
    ).length

    this.setData({
      levels: rows,
      totalMembers: members.length,
      goldPlus,
      upgradedThisMonth: upgraded
    })
  },

  /* ------------------------------ 编辑 ------------------------------ */

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    const l = store.findById('levels', id)
    if (!l) return

    this.setData({
      state: 'edit',
      editing: id,
      editName: l.name,
      editRecharge: String((l.rechargeThreshold || 0) / 100),
      editConsume: String((l.consumeThreshold || 0) / 100),
      editDiscount: String(l.discount || 1),
      editPointRate: String(l.pointRate || 1)
    })
  },

  /** 新建等级：给一份空白表单 */
  openNew() {
    this.setData({
      state: 'edit',
      editing: '',
      editName: '',
      editRecharge: '',
      editConsume: '',
      editDiscount: '1',
      editPointRate: '1'
    })
  },

  closeEdit() {
    this.setData({ state: 'default', editing: null })
  },

  onEditInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  saveEdit() {
    const name = (this.data.editName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入等级名称', icon: 'none' })
      return
    }

    const patch = {
      name,
      rechargeThreshold: biz.toFen(this.data.editRecharge || 0),
      consumeThreshold: biz.toFen(this.data.editConsume || 0),
      discount: Math.min(1, Math.max(0.1, parseFloat(this.data.editDiscount) || 1)),
      pointRate: Math.max(0, parseFloat(this.data.editPointRate) || 1)
    }

    if (this.data.editing) {
      store.patch('levels', this.data.editing, patch)
    } else {
      // 新等级排在现有最高级之上
      const maxSort = Math.max.apply(
        null,
        biz.levels().map((l) => l.sort || 0).concat([0])
      )
      store.put('levels', Object.assign({}, patch, {
        _id: store.uid('level'),
        sort: maxSort + 1,
        birthdayGift: false,
        onSale: true
      }))
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    biz.syncNow().catch(() => {})
    this.setData({ state: 'default', editing: null })
    this.loadData()
  },

  toggleGift(e) {
    const id = e.currentTarget.dataset.id
    const l = store.findById('levels', id)
    if (!l) return
    store.patch('levels', id, { birthdayGift: !l.birthdayGift })
    biz.syncNow().catch(() => {})
    this.loadData()
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
