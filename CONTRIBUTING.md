# 贡献指南

## 环境

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版即可）
- 任意现代浏览器（跑 `design/` 静态原型）
- Node.js **仅**用于跑数据层自测脚本，项目没有构建步骤

## 跑起来

```bash
# 原型（不需要任何环境）
浏览器打开 design/home.html

# 小程序
微信开发者工具 → 导入项目 → 选 miniapp/ 目录 → AppID 用测试号或自己的

# 数据层自测
node miniapp/utils/__smoke.js
```

## 改样式

**不要直接在页面的 `<style>` 或 `.wxss` 里写死颜色和字号。**

- 原型端：改 `design/tokens.css` 的 CSS 变量
- 小程序端：改 `miniapp/app.wxss` 里 `page { --xxx }` 的变量

共用组件（卡片、按钮、单元格、标签）的样式在 `design/app.css` 和 `miniapp/app.wxss` 里，页面文件只写这一屏特有的样式。

## 改数据

数据层分三层，**别跨层调用**：

| 层 | 文件 | 谁能调 |
|---|---|---|
| 业务层 | `utils/biz.js` | 页面只能调这一层 |
| 存储层 | `utils/store.js` | 只有 `biz.js` 和 `sync.js` 调 |
| 同步层 | `utils/sync.js` | 只有 `biz.js` 和 `app.js` 调 |

### 三条硬规矩

**1. 页面不碰 `wx.setStorageSync`**

所有读写都走 `biz`。直接写存储会绕开发件箱，导致数据推不上云。

**2. 金额一律用「分」存整数**

```js
balance: 128000   // 1280.00 元

biz.money(128000)      // "1,280.00" 展示用
biz.toFen('128.00')    // 12800      输入转回来
```

浮点存钱迟早出事，别图省事。

**3. 写操作后调 `biz.syncNow().catch(() => {})`**

```js
const r = biz.recharge(memberId, 50000)
if (!r.ok) { wx.showToast({ title: r.msg }); return }

biz.syncNow().catch(() => {})   // 后台推云，失败不影响结果
```

先落本地、立即返回，推送是异步的。**必须加 `.catch()`**，否则断网时会抛未捕获的 Promise 错误。

### 加一个业务动作

1. 在 `biz.js` 里写函数，**必须返回 `{ ok, ... }`，不能抛错**
2. 校验失败返回 `{ ok: false, msg: '原因' }`，页面直接 `wx.showToast({ title: r.msg })`
3. 数据变更走 `store.put` / `store.patch`，它们会自动进发件箱
4. 如果是新集合，同步改 `store.js` 的 `COLLS` 数组和云函数里的白名单

### 加一个集合

1. `store.js` 的 `COLLS` 加名字
2. `cloudfunctions/sync/index.js` 的 `COLLS` 加同样的名字
3. `seed.js` 里加初始数据（如果需要有默认值）
4. `docs/CLOUD.md` 的集合表里补一行

## 加页面

1. 在 `design/` 加一个 HTML，`<head>` 里带 `<meta name="dsh-design" content="miniprogram">`
2. 在 `miniapp/pages/<name>/` 加 4 个文件（`.wxml` `.wxss` `.js` `.json`）
3. 在 `miniapp/app.json` 的 `pages` 数组里注册
4. 页面 `js` 里补 `go` 跳转和 `onInput` 输入处理
5. 如果需要跳转到它，把路由加进**所有页面**的 `routes` 对象（现在每个页面各有一份，可以抽成 `utils/nav.js`）

## 代码约定

- **单位**：小程序端一律 `rpx`（1px ≈ 2rpx），原型端用 `px` + 变量
- **图标**：加进 `design/icons.svg` 的 `<symbol>`，小程序端在 `app.wxss` 里加对应的 `mask-image`
- **文案**：界面文案用中文，中英文之间留一个空格
- **示例数据**：只用虚构人名和脱敏手机号（`138 0000 0000`），不要用能对应到真人的信息
- **别加外链**：字体、图片、样式都不要连外网，离线要能正常显示
- **别用状态类做筛选**：`.st-xxx` 只用于视觉状态（如弹层开关），数据筛选请用 `data` + `wx:if`

## 提交

- 一个 PR 做一件事，标题写清楚改了什么
- 涉及界面的改动附一张截图
- 改了数据层的话，先跑 `node miniapp/utils/__smoke.js` 确认 55 项全过
- 大改动先开 Issue 聊方向，避免白做

## 许可

提交代码即表示同意以 [MIT](LICENSE) 协议发布。
