const app = getApp()
const biz = require('../../utils/biz')

const SEARCH_HINTS = {
  suffix: '输入手机号后四位',
  phone: '输入 11 位手机号',
  card: '输入会员卡号'
}

const SEARCH_NOTES = {
  suffix: '支持手机号后四位模糊匹配，命中多人时可继续选择。',
  phone: '按完整手机号精确匹配。',
  card: '按卡号精确匹配，实体卡与电子卡通用。'
}

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    memberId: '',
    member: null,
    balanceInt: '0',
    balanceDec: '00',
    balanceText: '0.00',

    // 核销模式
    mode: 'both', // balance | card | both

    // 余额部分
    services: [],
    pickedService: '',
    customMode: false,
    amountInput: '',
    amount: 0,
    amountText: '0.00',
    afterText: '0.00',

    // 次卡部分
    activeCards: [],
    cardLeftTotal: 0,
    cardTotalTimes: 0,
    cardSummaryText: '',

    // 合计
    willPoints: 0,
    totalText: '0.00',
    canSubmit: false,

    // 搜索
    searchMode: 'suffix',
    keyword: '',
    searchHint: SEARCH_HINTS.suffix,
    searchNote: SEARCH_NOTES.suffix,
    matches: [],

    // 今日核销
    todayRecords: [],
    todayCount: 0,
    todayAmountText: '0'
  },

  onLoad(options) {
    const o = options || {}
    const mode = o.mode
    const valid = ['balance', 'card', 'both']
    this.setData({
      memberId: o.id || '',
      mode: valid.indexOf(mode) >= 0 ? mode : 'both'
    })
    if (o.state === 'search') this.setData({ state: 'search' })
  },

  onShow() {
    app.applyTheme(this)
    this.loadServices()
    this.loadMember()
    this.loadToday()
    biz.refresh()
  },

  /* ------------------------------ 基础数据 ------------------------------ */

  loadServices() {
    const services = biz.services().map((s) => ({
      id: s._id,
      name: s.name,
      price: s.price,
      priceText: biz.moneyShort(s.price)
    }))
    this.setData({ services })
  },

  loadMember() {
    const id = this.data.memberId
    if (!id) {
      this.setData({ member: null })
      return
    }

    const m = biz.memberById(id)
    if (!m) {
      this.setData({ member: null })
      return
    }

    const parts = String(biz.money(m.balance)).split('.')
    const cards = biz
      .cardsOf(id)
      .map(biz.cardRow)
      .filter((c) => !c.isUsedUp)
      .map((c) =>
        Object.assign(c, {
          picked: 0,
          gray: false
        })
      )

    const leftTotal = cards.reduce((s, c) => s + c.left, 0)

    this.setData({
      member: Object.assign(biz.memberRow(m), {
        statusText:
          m.status === 'sleeping'
            ? '沉睡'
            : m.status === 'disabled'
            ? '停用'
            : '正常'
      }),
      balanceInt: parts[0],
      balanceDec: parts[1] || '00',
      balanceText: biz.money(m.balance),
      activeCards: cards,
      cardLeftTotal: leftTotal
    })

    this.recalc()
  },

  loadToday() {
    const { from } = biz.rangeOf('day')
    const list = biz
      .records({ from })
      .filter((r) => r.type === 'consume' || r.type === 'cardverify')

    const rows = list.slice(0, 3).map((r) => {
      const m = biz.memberById(r.memberId)
      const row = biz.recordRow(r)
      return {
        id: r._id,
        memberId: r.memberId,
        initial: ((m && m.name) || '?').slice(0, 1),
        avaClass:
          r.type === 'cardverify' ? 'teal' : m && m.levelId === 'level-gold' ? 'gold' : '',
        title: row.title + (r.items && r.items[0] ? ' · ' + r.items[0].name : ''),
        subText: row.timeText + (row.remark ? ' · ' + row.remark : ''),
        amountText:
          r.type === 'cardverify'
            ? '−' + (r.items && r.items[0] ? r.items[0].qty : 1)
            : '−¥' + biz.money(r.amount),
        unit: r.type === 'cardverify' ? '次' : ''
      }
    })

    const total = list.reduce((s, r) => s + (r.amount || 0), 0)

    this.setData({
      todayRecords: rows,
      todayCount: list.length,
      todayAmountText: biz.moneyShort(total)
    })
  },

  /* ------------------------------ 核销计算 ------------------------------ */

  pickMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
    this.recalc()
  },

  pickService(e) {
    const id = e.currentTarget.dataset.id
    const svc = this.data.services.find((s) => s.id === id)
    if (!svc) return

    this.setData({
      pickedService: id,
      customMode: false,
      amountInput: (svc.price / 100).toFixed(2)
    })
    this.recalc()
  },

  useCustom() {
    this.setData({ customMode: true, pickedService: '', amountInput: '' })
    this.recalc()
  },

  onAmountInput(e) {
    this.setData({ amountInput: e.detail.value })
    this.recalc()
  },

  stepCard(e) {
    const id = e.currentTarget.dataset.id
    const delta = Number(e.currentTarget.dataset.delta) || 0

    const cards = this.data.activeCards.map((c) => {
      if (c.id !== id) return c
      const next = Math.max(0, Math.min(c.left, c.picked + delta))
      return Object.assign({}, c, { picked: next, gray: next === 0 })
    })

    this.setData({ activeCards: cards })
    this.recalc()
  },

  recalc() {
    const d = this.data
    const amount = biz.toFen(d.amountInput || 0)
    const balance = d.member ? d.member.balance || 0 : 0

    // 次卡合计次数
    let cardTimes = 0
    const names = []
    d.activeCards.forEach((c) => {
      if (c.picked > 0) {
        cardTimes += c.picked
        names.push(c.name + ' ' + c.picked + ' 次')
      }
    })

    // 按模式归零
    const effAmount = d.mode === 'card' ? 0 : amount
    const effTimes = d.mode === 'balance' ? 0 : cardTimes

    const cfg = biz.config()
    const rate = (cfg.pointRules && cfg.pointRules.consume) || 0
    const willPoints = Math.floor((effAmount / 100) * rate)

    const totalText =
      effAmount > 0 && effTimes > 0
        ? '¥' + biz.money(effAmount) + ' + ' + effTimes + ' 次'
        : effTimes > 0
        ? '次卡 ' + effTimes + ' 次'
        : '¥' + biz.money(effAmount)

    // 余额是否够
    const enough = effAmount <= balance
    const canSubmit =
      (effAmount > 0 || effTimes > 0) && enough && d.member != null

    this.setData({
      amount: effAmount,
      amountText: biz.money(effAmount),
      afterText: biz.money(Math.max(0, balance - effAmount)),
      cardTotalTimes: effTimes,
      cardSummaryText: names.join('、'),
      willPoints,
      totalText,
      canSubmit
    })
  },

  /* ------------------------------ 提交 ------------------------------ */

  submit() {
    if (!this.data.member) {
      wx.showToast({ title: '请先选择会员', icon: 'none' })
      return
    }
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请先选择服务项或次卡次数', icon: 'none' })
      return
    }

    const { amount, activeCards, memberId } = this.data
    const picked = activeCards.filter((c) => c.picked > 0)

    wx.showModal({
      title: '确认核销',
      content: this.data.totalText,
      success: (res) => {
        if (!res.confirm) return

        // 余额部分
        if (amount > 0) {
          const items = this.data.pickedService
            ? [
                {
                  name: (
                    this.data.services.find(
                      (s) => s.id === this.data.pickedService
                    ) || {}
                  ).name,
                  price: amount,
                  qty: 1
                }
              ]
            : [{ name: '其他金额', price: amount, qty: 1 }]

          const r = biz.consume(memberId, amount, items)
          if (!r.ok) {
            wx.showToast({ title: r.msg, icon: 'none' })
            return
          }
        }

        // 次卡部分
        let failed = ''
        for (const c of picked) {
          const r = biz.verifyCard(memberId, c.id, c.picked)
          if (!r.ok) {
            failed = r.msg
            break
          }
        }

        if (failed) {
          wx.showToast({ title: failed, icon: 'none' })
        } else {
          wx.showToast({ title: '核销成功', icon: 'success' })
        }

        // 先落本地再推云，断网也不影响
        biz.syncNow().catch(() => {})

        this.setData({
          memberId: '',
          member: null,
          state: 'search',
          keyword: '',
          matches: [],
          amountInput: '',
          pickedService: '',
          customMode: false
        })
        this.loadToday()
      }
    })
  },

  /* ------------------------------ 搜索 ------------------------------ */

  pickSearchMode(e) {
    const m = e.currentTarget.dataset.mode
    this.setData({
      searchMode: m,
      searchHint: SEARCH_HINTS[m],
      searchNote: SEARCH_NOTES[m],
      keyword: '',
      matches: []
    })
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },

  doSearch() {
    const k = (this.data.keyword || '').trim()
    if (!k) {
      wx.showToast({ title: '请输入查询内容', icon: 'none' })
      return
    }

    const mode = this.data.searchMode
    let hits = []

    if (mode === 'suffix') {
      hits = biz.findMembersBySuffix(k)
    } else if (mode === 'phone') {
      const m = biz.findMember(k)
      hits = m ? [m] : []
    } else {
      const all = biz.listMembers({})
      hits = all.filter(
        (m) => (m.cardNo || '').toUpperCase() === k.toUpperCase()
      )
    }

    if (!hits.length) {
      wx.showToast({ title: '没有找到会员', icon: 'none' })
      this.setData({ matches: [] })
      return
    }

    if (hits.length === 1) {
      this.selectMember(hits[0]._id)
      return
    }

    // 多人命中，让用户选
    this.setData({
      matches: hits.map(biz.memberRow)
    })
  },

  chooseMember(e) {
    this.selectMember(e.currentTarget.dataset.id)
  },

  selectMember(id) {
    this.setData({
      memberId: id,
      state: 'default',
      matches: [],
      keyword: ''
    })
    this.loadMember()
  },

  reselect() {
    this.setData({
      memberId: '',
      member: null,
      state: 'search',
      matches: [],
      keyword: '',
      amountInput: '',
      pickedService: '',
      customMode: false
    })
  },

  openMember(e) {
    const id = e.currentTarget.dataset.member
    if (!id) return
    wx.navigateTo({ url: '/pages/member-detail/member-detail?id=' + id })
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
