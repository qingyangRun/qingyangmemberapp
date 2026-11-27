const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    inputs: { f0: '', f1: '', f2: '' },
    gender: 'female',
    birthday: '',
    today: '',

    cardTypes: [],
    pickedCards: [],

    balanceFen: 0,
    balanceText: '0.00',
    cardTotal: 0,
    cardTotalText: '0.00',
    grandTotalText: '0.00',
    willLevelName: '普通'
  },

  onLoad() {
    const t = new Date()
    this.setData({
      today:
        t.getFullYear() +
        '-' +
        String(t.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(t.getDate()).padStart(2, '0')
    })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadData()
  },

  loadData() {
    const cardTypes = biz
      .cardTypes()
      .filter((c) => c.onSale !== false)
      .map((c, i) => ({
        id: c._id,
        name: c.name,
        times: c.times,
        validDays: c.validDays || 365,
        price: c.price,
        priceText: biz.moneyShort(c.price),
        unitPrice: (c.price / 100 / c.times).toFixed(1),
        hot: i === 0
      }))

    this.setData({ cardTypes })
    this.recalc()
  },

  /* ------------------------------ 表单 ------------------------------ */

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['inputs.' + key]: e.detail.value })
    this.recalc()
  },

  pickGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender })
  },

  onBirthday(e) {
    this.setData({ birthday: e.detail.value })
  },

  toggleCard(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.pickedCards.slice()
    const i = list.indexOf(id)
    if (i >= 0) list.splice(i, 1)
    else list.push(id)
    this.setData({ pickedCards: list })
    this.recalc()
  },

  /** 重算合计与预估等级 */
  recalc() {
    const balanceFen = biz.toFen(this.data.inputs.f2 || 0)

    let cardTotal = 0
    this.data.pickedCards.forEach((id) => {
      const c = this.data.cardTypes.find((x) => x.id === id)
      if (c) cardTotal += c.price
    })

    const grand = balanceFen + cardTotal

    // 按累计充值预估等级
    const levels = biz.levels() // 降序
    let willLevel = levels[levels.length - 1]
    for (const l of levels) {
      if (grand >= (l.rechargeThreshold || 0)) {
        willLevel = l
        break
      }
    }

    this.setData({
      balanceFen,
      balanceText: biz.money(balanceFen),
      cardTotal,
      cardTotalText: biz.money(cardTotal),
      grandTotalText: biz.money(grand),
      willLevelName: willLevel ? willLevel.name : '普通'
    })
  },

  /* ------------------------------ 提交 ------------------------------ */

  submit() {
    const phone = (this.data.inputs.f0 || '').replace(/\s/g, '')
    const name = (this.data.inputs.f1 || '').trim()

    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' })
      return
    }
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    // 按累计充值定等级
    const levels = biz.levels()
    let levelId = levels[levels.length - 1] ? levels[levels.length - 1]._id : 'level-normal'
    for (const l of levels) {
      if (this.data.balanceFen >= (l.rechargeThreshold || 0)) {
        levelId = l._id
        break
      }
    }

    const r = biz.createMember({
      phone,
      name,
      gender: this.data.gender,
      birthday: this.data.birthday,
      balance: this.data.balanceFen,
      levelId,
      cardTypeIds: this.data.pickedCards
    })

    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' })
      return
    }

    wx.showToast({ title: '创建成功', icon: 'success' })
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/member-detail/member-detail?id=' + r.member._id
      })
    }, 700)
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
