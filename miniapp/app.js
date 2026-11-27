const sync = require('./utils/sync')
const seed = require('./utils/seed')

const NAV_COLORS = {
  blue: '#2457F5',
  green: '#0F7A5A',
  violet: '#5B3FD1',
  orange: '#BF5A14',
  rose: '#BF3566',
  graphite: '#2B3A52'
}

function applyNavBar(theme) {
  try {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: NAV_COLORS[theme] || NAV_COLORS.blue,
      animation: { duration: 200, timingFunc: 'easeIn' }
    })
  } catch (e) {}
}

App({
  globalData: {
    theme: 'blue',
    // 从其他 tab 页跳到会员页时用全局状态传筛选态（switchTab 不支持 query）
    pendingMembersState: '',
    // 把你的云开发环境 ID 填在这里；留空则自动使用纯本地模式
    env: ''
  },

  onLaunch() {
    // 1. 首次启动灌示例数据（本地已有数据就跳过）
    seed.seed()

    // 2. 主题
    this.globalData.theme = wx.getStorageSync('qy-theme') || 'blue'
    applyNavBar(this.globalData.theme)

    // 3. 探测云环境并建立网络监听
    //    探测失败不影响使用，界面自动跑在纯本地模式
    const ok = sync.probe()
    sync.bindNetwork()

    if (ok) {
      // 稍微延迟，避免和首屏渲染抢资源
      setTimeout(() => {
        sync.sync().then((res) => {
          if (res.ok) {
            console.log('[sync] 首次同步完成', res)
          } else {
            console.warn('[sync] 降级为本地模式：', res.msg)
          }
        })
      }, 600)
    } else {
      console.log('[sync] 未配置云环境，运行在纯本地模式')
    }
  },

  setTheme(theme) {
    this.globalData.theme = theme || 'blue'
    wx.setStorageSync('qy-theme', this.globalData.theme)
    applyNavBar(this.globalData.theme)
  },

  /** 页面 onShow 调用：同步主题数据并给当前页面导航条上色 */
  applyTheme(page) {
    const theme = this.globalData.theme
    if (page && page.setData) page.setData({ theme })
    applyNavBar(theme)
  }
})
