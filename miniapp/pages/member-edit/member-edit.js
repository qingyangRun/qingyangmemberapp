const app = getApp()
const biz = require('../../utils/biz')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    selected: '',

    memberId: '',
    member: null,
    inputs: { f0: '', f1: '', f2: '' },
    gender: 'female',
    birthday: '',

    tags: [],
    status: 'normal',

    levelName: '',
    levelBadge: 'gold',
    rechargeText: '0',
    consumeText: '0',

    cards: []
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ memberId: id })
  },

  onShow() {
    this.setData({ theme: app.globalData.theme })
    this.loadData()
  },

  loadData() {
    let id = this.data.memberId

    // 没传 id 时兜底取第一位，避免空白页
    if (!id) {
      const first = biz.listMembers({})[0]
      if (first) {
        id = first._id
        this.setData({ memberId: id })
      }
    }
    if (!id) return

    const m = biz.memberById(id)
    if (!m) return

    const cfg = biz.config()
    const tagPool = ['高复购', '生日月', '敏感头皮', '只做烫染', '转介绍', '沉睡唤醒']
    const mine = m.tags || []

    this.setData({
      member: biz.memberRow(m),
      inputs: {
        f0: m.name || '',
        f1: biz.prettyPhone(m.phone),
        f2: m.remark || ''
      },
      gender: m.gender || '',
      birthday: m.birthday || '',
      status: m.status || 'normal',
      tags: tagPool.map((t) => ({ name: t, on: mine.indexOf(t) >= 0 })),
      levelName: biz.levelName(m.levelId),
      levelBadge: biz.levelBadge(m.levelId),
      rechargeText: biz.moneyShort(m.totalRecharge || 0),
      consumeText: biz.moneyShort(m.totalConsume || 0),
      cards: biz.cardsOf(id)
        .map(biz.cardRow)
        .filter((c) => !c.isUsedUp)
    })
  },

  /* ------------------------------ 表单 ------------------------------ */

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['inputs.' + key]: e.detail.value })
  },

  pickGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender })
  },

  pickStatus(e) {
    this.setData({ status: e.currentTarget.dataset.status })
  },

  onBirthday(e) {
    this.setData({ birthday: e.detail.value })
  },

  toggleTag(e) {
    const name = e.currentTarget.dataset.tag
    this.setData({
      tags: this.data.tags.map((t) =>
        t.name === name ? { name: t.name, on: !t.on } : t
      )
    })
  },

  /* ------------------------------ 保存 ------------------------------ */

  save() {
    const phone = (this.data.inputs.f1 || '').replace(/\s/g, '')
    const name = (this.data.inputs.f0 || '').trim()

    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' })
      return
    }
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    // 手机号改了要查重
    const cur = biz.memberById(this.data.memberId)
    if (cur && phone !== cur.phone) {
      const dup = biz.listMembers({}).some(
        (m) => m.phone === phone && m._id !== cur._id
      )
      if (dup) {
        wx.showToast({ title: '该手机号已被其他会员占用', icon: 'none' })
        return
      }
    }

    const r = biz.updateMember(this.data.memberId, {
      name,
      phone,
      gender: this.data.gender,
      birthday: this.data.birthday,
      status: this.data.status,
      remark: this.data.inputs.f2 || '',
      tags: this.data.tags.filter((t) => t.on).map((t) => t.name)
    })

    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' })
      return
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    biz.syncNow().catch(() => {})

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/member-detail/member-detail?id=' + this.data.memberId
      })
    }, 600)
  },

  /** 删除会员：软删除，保留流水 */
  removeMember() {
    const m = this.data.member
    if (!m) return

    wx.showModal({
      title: '停用该会员',
      content:
        '停用后无法充值、核销，但会保留全部记录，可随时恢复。确定吗？',
      confirmText: '停用',
      confirmColor: '#C0342B',
      success: (res) => {
        if (!res.confirm) return
        const r = biz.disableMember(this.data.memberId)
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' })
          return
        }
        wx.showToast({ title: '已停用', icon: 'success' })
        biz.syncNow().catch(() => {})
        setTimeout(() => {
          wx.switchTab({ url: '/pages/members/members' })
        }, 600)
      }
    })
  },

  goBuyCard() {
    wx.navigateTo({
      url: '/pages/recharge/recharge?state=card&id=' + this.data.memberId
    })
  },

  goLevels() {
    wx.navigateTo({ url: '/pages/levels/levels' })
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
