const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    memberId: '',
    member: null,
    cards: [],
    cardLeftTotal: 0,
    cardCount: 0,
    progress: null,

    recType: 'consume',
    recList: []
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ memberId: id })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadData()
    biz.refresh()
  },

  /* ------------------------------ 数据 ------------------------------ */

  loadData() {
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

    // 会员展示结构
    const parts = String(biz.money(m.balance)).split('.')
    const member = Object.assign(biz.memberRow(m), {
      balanceInt: parts[0],
      balanceDec: parts[1] || '00',
      joinedText: biz.ymd(m.joinedAt),
      statusText:
        m.status === 'sleeping'
          ? '沉睡'
          : m.status === 'disabled'
          ? '停用'
          : '正常'
    })

    // 次卡
    const cards = biz.cardsOf(id).map(biz.cardRow)
    const active = cards.filter((c) => !c.isUsedUp)
    const leftTotal = active.reduce((s, c) => s + c.left, 0)

    // 升级进度
    const progress = this.calcProgress(m)

    this.setData({
      member,
      cards,
      cardLeftTotal: leftTotal,
      cardCount: active.length,
      progress
    })

    this.loadRecords()
  },

  /** 算距离下一等级还差多少 */
  calcProgress(m) {
    const ls = biz.levels() // 已按 sort 降序
    const cur = ls.find((l) => l._id === m.levelId) || ls[ls.length - 1]
    if (!cur) return null

    const idx = ls.indexOf(cur)
    const next = idx > 0 ? ls[idx - 1] : null // 更高一级
    if (!next) return null // 已是最高级

    const target = next.consumeThreshold || 0
    const current = m.totalConsume || 0
    if (!target) return null

    return {
      nextName: next.name,
      currentText: biz.moneyShort(current),
      targetText: biz.moneyShort(target),
      percent: Math.min(100, Math.round((current / target) * 100))
    }
  },

  loadRecords() {
    const rows = biz
      .records({ memberId: this.data.memberId, type: this.data.recType })
      .slice(0, 12)
      .map((r) => {
        const row = biz.recordRow(r)
        const t = new Date(r.createdAt)
        return Object.assign(row, {
          dateText: biz.md(r.createdAt),
          clockText:
            String(t.getHours()).padStart(2, '0') +
            ':' +
            String(t.getMinutes()).padStart(2, '0'),
          detailText: r.items && r.items.length ? ' · ' + r.items[0].name : '',
          remark: row.remark || row.typeName,
          amountText:
            r.type === 'cardverify'
              ? '−1 次'
              : (r.type === 'recharge' ? '+' : '−') + '¥' + biz.money(r.amount)
        })
      })

    this.setData({ recList: rows })
  },

  pickRecType(e) {
    this.setData({ recType: e.currentTarget.dataset.type })
    this.loadRecords()
  },

  /* ------------------------------ 操作 ------------------------------ */

  goRecharge() {
    wx.navigateTo({
      url: '/pages/recharge/recharge?id=' + this.data.memberId
    })
  },

  goBuyCard() {
    wx.navigateTo({
      url: '/pages/recharge/recharge?state=card&id=' + this.data.memberId
    })
  },

  goVerify() {
    wx.navigateTo({
      url: '/pages/verify/verify?id=' + this.data.memberId
    })
  },

  goRecords() {
    wx.switchTab({ url: '/pages/records/records' })
  },

  openEdit() {
    wx.navigateTo({
      url: '/pages/member-edit/member-edit?id=' + this.data.memberId
    })
  },

  /** 直接核销一次次卡 */
  verifyCard(e) {
    const cardId = e.currentTarget.dataset.id
    const card = this.data.cards.find((c) => c.id === cardId)
    if (!card) return

    wx.showModal({
      title: '核销次卡',
      content: '确认核销 1 次「' + card.name + '」？剩余 ' + card.left + ' 次。',
      success: (res) => {
        if (!res.confirm) return
        const r = biz.verifyCard(this.data.memberId, cardId, 1)
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' })
          return
        }
        wx.showToast({ title: '核销成功', icon: 'success' })
        this.loadData()
        biz.syncNow()
      }
    })
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
