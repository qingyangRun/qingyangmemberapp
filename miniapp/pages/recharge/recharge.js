const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    memberId: '',
    member: null,
    balanceText: '0.00',

    // 充值
    tiers: [],
    tierHint: '',
    amount: 0,
    amountInput: '',
    amountText: '0.00',
    gift: 0,
    giftText: '0.00',
    arriveText: '0.00',
    willPoints: 0,
    progress: null,

    // 次卡
    cardTypes: [],
    pickedCardId: '',
    pickedCard: null,
    pickedCardPriceText: '0.00',

    pay: 'wechat',
    inputs: { f1: '' },

    syncText: '本地存储'
  },

  onLoad(options) {
    const o = options || {}
    const st = o.state === 'card' ? 'card' : 'default'
    this.setData({
      state: st,
      memberId: o.id || ''
    })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadData()
  },

  /* ------------------------------ 数据 ------------------------------ */

  loadData() {
    const cfg = biz.config()
    const tiers = (cfg.rechargeTiers || []).map((t) => ({
      amount: t.amount,
      label: biz.moneyShort(t.amount),
      gift: t.gift || 0
    }))

    const cardTypes = biz.cardTypes()
      .filter((c) => c.onSale !== false)
      .map((c) => ({
        id: c._id,
        name: c.name,
        times: c.times,
        validDays: c.validDays || 365,
        price: c.price,
        priceText: biz.moneyShort(c.price),
        unitPrice: (c.price / 100 / c.times).toFixed(1),
        points: Math.floor((c.price / 100) * ((cfg.pointRules && cfg.pointRules.consume) || 1))
      }))

    const tierHint = tiers.length
      ? '充 ' + tiers[1 < tiers.length ? 1 : 0].label + ' 赠 ' + biz.moneyShort(tiers[1 < tiers.length ? 1 : 0].gift)
      : ''

    this.setData({ tiers, cardTypes, tierHint })

    // 默认选中第二档（对应设计稿的 ¥500）
    if (!this.data.amount && tiers.length) {
      const def = tiers[1] || tiers[0]
      this.setAmount(def.amount)
    } else if (this.data.amount) {
      this.setAmount(this.data.amount)
    }

    // 默认选中第一张次卡
    if (!this.data.pickedCardId && cardTypes.length) {
      this.pickCardById(cardTypes[0].id)
    } else if (this.data.pickedCardId) {
      this.pickCardById(this.data.pickedCardId)
    }

    this.loadMember()
  },

  loadMember() {
    const id = this.data.memberId
    const s = biz.syncStatus()
    this.setData({ syncText: s.mode === 'cloud' ? '云端同步' : '本地存储' })

    if (!id) {
      // 没传 id 时取第一个会员，避免空白页
      const first = biz.listMembers({})[0]
      if (first) {
        this.setData({ memberId: first._id })
        this.loadMember()
      }
      return
    }

    const m = biz.memberById(id)
    if (!m) return

    this.setData({
      member: biz.memberRow(m),
      balanceText: biz.money(m.balance),
      progress: this.calcProgress(m)
    })
  },

  calcProgress(m) {
    const ls = biz.levels()
    const cur = ls.find((l) => l._id === m.levelId) || ls[ls.length - 1]
    if (!cur) return null
    const idx = ls.indexOf(cur)
    const next = idx > 0 ? ls[idx - 1] : null
    if (!next) return null

    const target = next.consumeThreshold || 0
    const current = m.totalConsume || 0
    if (!target) return null

    return {
      nextName: next.name,
      currentText: biz.moneyShort(current),
      targetText: biz.moneyShort(target),
      diffText: biz.moneyShort(Math.max(0, target - current)),
      percent: Math.min(100, Math.round((current / target) * 100))
    }
  },

  /* ------------------------------ 充值金额 ------------------------------ */

  /** 按金额算赠送：命中档位给对应赠额，没命中按最近低档的比例估 */
  calcGift(amount) {
    const tiers = this.data.tiers
    if (!tiers.length) return 0

    const hit = tiers.find((t) => t.amount === amount)
    if (hit) return hit.gift || 0

    // 自定义金额：取不超过它的最高档，按比例折算
    const lower = tiers
      .filter((t) => t.amount <= amount && t.gift > 0)
      .sort((a, b) => b.amount - a.amount)[0]

    if (!lower) return 0
    return Math.floor((amount / lower.amount) * lower.gift)
  },

  setAmount(fen) {
    const gift = this.calcGift(fen)
    const total = fen + gift
    const cfg = biz.config()
    const rate = (cfg.pointRules && cfg.pointRules.recharge) || 0

    this.setData({
      amount: fen,
      amountInput: fen ? (fen / 100).toFixed(2) : '',
      amountText: biz.money(fen),
      gift,
      giftText: biz.money(gift),
      arriveText: biz.money(total),
      willPoints: Math.floor((fen / 100) * rate)
    })
  },

  pickAmount(e) {
    const v = Number(e.currentTarget.dataset.amount) || 0
    this.setAmount(v)
  },

  onAmountInput(e) {
    const raw = e.detail.value
    const fen = biz.toFen(raw)
    this.setData({ amountInput: raw })
    this.setAmount(fen)
  },

  /* ------------------------------ 次卡 ------------------------------ */

  pickCard(e) {
    this.pickCardById(e.currentTarget.dataset.id)
  },

  pickCardById(id) {
    const c = this.data.cardTypes.find((x) => x.id === id)
    this.setData({
      pickedCardId: id,
      pickedCard: c || null,
      pickedCardPriceText: c ? biz.money(c.price) : '0.00'
    })
  },

  pickPay(e) {
    this.setData({ pay: e.currentTarget.dataset.pay })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['inputs.' + key]: e.detail.value })
  },

  /* ------------------------------ 提交 ------------------------------ */

  submitRecharge() {
    if (!this.data.member) {
      wx.showToast({ title: '请先选择会员', icon: 'none' })
      return
    }
    if (!this.data.amount || this.data.amount <= 0) {
      wx.showToast({ title: '请输入充值金额', icon: 'none' })
      return
    }

    const r = biz.recharge(
      this.data.memberId,
      this.data.amount,
      this.data.inputs.f1
    )

    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' })
      return
    }

    wx.showToast({ title: '收款成功', icon: 'success' })

    // 写完先落本地，再后台推云；断网也不影响结果
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/member-detail/member-detail?id=' + this.data.memberId
      })
    }, 700)
  },

  submitBuyCard() {
    if (!this.data.member) {
      wx.showToast({ title: '请先选择会员', icon: 'none' })
      return
    }
    if (!this.data.pickedCard) {
      wx.showToast({ title: '请选择次卡项目', icon: 'none' })
      return
    }

    const r = biz.buyCard(this.data.memberId, this.data.pickedCardId)
    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' })
      return
    }

    wx.showToast({ title: '开卡成功', icon: 'success' })
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/member-detail/member-detail?id=' + this.data.memberId
      })
    }, 700)
  },

  goSearchMember() {
    wx.navigateTo({ url: '/pages/verify/verify?state=search' })
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
    this.setData({ state: e.currentTarget.dataset.state })
  }
})
