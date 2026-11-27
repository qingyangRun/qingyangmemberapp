const app = getApp()
const biz = require('../../utils/biz')
const store = require('../../utils/store')

const RULE_META = {
  recharge: {
    name: '余额充值',
    desc: '充值到账后入账，赠送金额不计积分',
    ic: 'i-wallet',
    leadClass: ''
  },
  consume: {
    name: '消费核销',
    desc: '余额或次卡核销后，按消费金额入账',
    ic: 'i-scan',
    leadClass: 'teal'
  },
  cardbuy: {
    name: '购买次卡',
    desc: '次卡收款后按售价入账，退款时扣回',
    ic: 'i-cards',
    leadClass: 'gold'
  }
}

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    enabled: true,
    rules: [],
    enabledCount: 0,

    sampleName: '会员',
    sampleRecharge: '500',
    sampleConsume: '128',
    sampleRechargePoints: 0,
    sampleConsumePoints: 0
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadData()
  },

  loadData() {
    const cfg = biz.config()
    const pr = cfg.pointRules || {}

    const rules = ['recharge', 'consume', 'cardbuy'].map((key) => ({
      key,
      name: RULE_META[key].name,
      desc: RULE_META[key].desc,
      ic: RULE_META[key].ic,
      leadClass: RULE_META[key].leadClass,
      on: pr[key] === undefined ? true : pr[key] > 0,
      value: pr[key] === undefined ? '1' : String(pr[key])
    }))

    // 示例会员：取余额最高的一位
    const members = biz.listMembers({})
    const top = members.sort((a, b) => (b.balance || 0) - (a.balance || 0))[0]

    this.setData({
      enabled: cfg.pointsEnabled !== false,
      rules,
      enabledCount: rules.filter((r) => r.on).length,
      sampleName: top ? top.name : '会员'
    })

    this.calcSample()
  },

  calcSample() {
    const rateOf = (key) => {
      const r = this.data.rules.find((x) => x.key === key)
      return r && r.on ? parseFloat(r.value) || 0 : 0
    }
    const recharge = 500
    const consume = 128

    this.setData({
      sampleRechargePoints: Math.floor(recharge * rateOf('recharge')),
      sampleConsumePoints: Math.floor(consume * rateOf('consume'))
    })
  },

  toggleEnabled() {
    this.setData({ enabled: !this.data.enabled })
  },

  toggleRule(e) {
    const key = e.currentTarget.dataset.key
    const rules = this.data.rules.map((r) =>
      r.key === key ? Object.assign({}, r, { on: !r.on }) : r
    )
    this.setData({
      rules,
      enabledCount: rules.filter((r) => r.on).length
    })
    this.calcSample()
  },

  onRuleInput(e) {
    const key = e.currentTarget.dataset.key
    const rules = this.data.rules.map((r) =>
      r.key === key ? Object.assign({}, r, { value: e.detail.value }) : r
    )
    this.setData({ rules })
    this.calcSample()
  },

  save() {
    const pr = {}
    this.data.rules.forEach((r) => {
      pr[r.key] = r.on ? parseFloat(r.value) || 0 : 0
    })

    store.patch('config', 'shop', {
      pointRules: pr,
      pointsEnabled: this.data.enabled
    })

    wx.showToast({ title: '已保存', icon: 'success' })
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.switchTab({ url: '/pages/settings/settings' })
    }, 600)
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
