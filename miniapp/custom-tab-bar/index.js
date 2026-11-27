Component({
  data: {
    selected: 'index',
    theme: 'blue'
  },

  methods: {
    switchTab(e) {
      const page = e.currentTarget.dataset.page
      wx.switchTab({ url: '/pages/' + page + '/' + page })
    }
  }
})
