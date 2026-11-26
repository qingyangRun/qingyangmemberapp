# 云开发后端接入指南

这份文档写的是**从零把微信云开发接进这个项目**的完整步骤。照着做，能把现在写死的示例数据换成真实的数据库读写。

> 预计耗时：环境开通 10 分钟，建集合与权限 20 分钟，第一个云函数跑通 30 分钟。
> 前提：你有一个小程序 AppID（测试号的云开发功能受限，建议用正式 AppID）。

---

## 目录

- [第 0 步：先想清楚要不要走这一步](#第-0-步先想清楚要不要走这一步)
- [第 1 步：开通云开发环境](#第-1-步开通云开发环境)
- [第 2 步：让项目认识云开发](#第-2-步让项目认识云开发)
- [第 3 步：建数据库集合](#第-3-步建数据库集合)
- [第 4 步：建索引](#第-4-步建索引)
- [第 5 步：配权限（最容易出事的一步）](#第-5-步配权限最容易出事的一步)
- [第 6 步：灌初始数据](#第-6-步灌初始数据)
- [第 7 步：写第一个云函数](#第-7-步写第一个云函数)
- [第 8 步：前端接上](#第-8-步前端接上)
- [第 9 步：钱相关操作的正确写法](#第-9-步钱相关操作的正确写法)
- [第 10 步：统计怎么做](#第-10-步统计怎么做)
- [常见坑](#常见坑)
- [做完之后的检查清单](#做完之后的检查清单)

---

## 第 0 步：先想清楚要不要走这一步

云开发不是免费的。官方现在的规则是：

- **免费体验环境**：每个账号 1 个，每月 3000 资源点，单次可续 6 个月
- **免费环境在小程序发布后会变成「上线后第 15 天到期」**，之后必须转付费
- **基础套餐 19.9 元/月**（原价 39 元，5 折长期有效）

也就是说：**自己玩、做演示，免费额度够用；真上线给店里用，按 20 元/月左右预算。**

如果你的目标只是「让别人 star」，可以先不接后端——界面本身已经能跑。要接的话，下面的顺序不要跳。

---

## 第 1 步：开通云开发环境

1. 用**正式 AppID** 打开微信开发者工具，导入 `miniapp/` 目录
   （`project.config.json` 里现在是 `touristappid`，游客模式**没有云开发**，必须换成自己的）
2. 点工具栏左上角「云开发」按钮
3. 首次会弹出开通引导，同意协议 → 创建环境
4. 环境名建议填 `prod`（生产）和 `dev`（开发），各建一个
   - 一个环境就是一套独立的数据库 / 存储 / 云函数
   - 开发期先在 `dev` 上折腾，跑通了再动 `prod`
5. 创建完成后，在「设置 → 环境设置」里记下**环境 ID**，形如 `qingyang-dev-8gxxxxx`

> 环境 ID 不是环境名，是那串带随机后缀的字符串。后面所有配置都用它。

---

## 第 2 步：让项目认识云开发

### 2.1 开启云函数目录

在 `miniapp/project.config.json` 里加一行：

```json
{
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "urlCheck": false,
    "es6": true
  }
}
```

然后在 `miniapp/` 下新建 `cloudfunctions/` 目录。加完之后开发者工具里这个目录会变成一朵云的图标，右键可以「上传并部署」。

### 2.2 初始化（本项目用显式传 env 的写法）

现在的 `miniapp/app.js` 只有主题逻辑，改成：

```js
App({
  globalData: {
    theme: 'blue',
    env: 'qingyang-dev-8gxxxxx'   // ← 换成你自己的环境 ID
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    })

    this.globalData.theme = wx.getStorageSync('qy-theme') || 'blue'
  },

  setTheme(theme) {
    this.globalData.theme = theme || 'blue'
    wx.setStorageSync('qy-theme', this.globalData.theme)
  }
})
```

**为什么不用 `env: wx.cloud.DYNAMIC_CURRENT_ENV`**：那个写法只在云函数里有效，小程序端要写死环境 ID 或从配置读。写死看起来笨，但最不容易出错。

---

## 第 3 步：建数据库集合

打开「云开发控制台 → 数据库」，逐个新建下面 7 个集合。**集合名必须完全一致**，代码里是硬编码的。

### 3.1 `members` — 会员

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动生成 |
| `_openid` | string | 自动写入，创建者 |
| `phone` | string | 11 位手机号，**唯一** |
| `name` | string | 姓名 |
| `gender` | string | `male` / `female` / `''` |
| `birthday` | string | `YYYY-MM-DD`，可空 |
| `levelId` | string | 指向 `levels._id` |
| `balance` | number | 余额，单位**分** |
| `points` | number | 积分 |
| `totalRecharge` | number | 累计充值，单位分 |
| `totalConsume` | number | 累计消费，单位分 |
| `tags` | array\<string\> | `["高复购","生日月"]` |
| `status` | string | `normal` / `sleeping` / `disabled` |
| `cardNo` | string | 卡号，如 `QH8821` |
| `remark` | string | 备注 |
| `joinedAt` | Date | 入会时间 |
| `lastVisitAt` | Date | 最近到店 |
| `createdAt` | Date | |
| `updatedAt` | Date | |

> **金额一律存「分」（整数）**。用浮点数存 12.80 会算出 12.799999，对账时能让你疯掉。展示时再除以 100。

### 3.2 `levels` — 等级

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 黑金 / 金卡 / 银卡 / 普通 |
| `sort` | number | 排序，越大越高 |
| `rechargeThreshold` | number | 累计充值门槛（分） |
| `consumeThreshold` | number | 累计消费门槛（分） |
| `discount` | number | 会员价折扣，如 `0.85` |
| `pointRate` | number | 积分倍率，如 `2` |
| `birthdayGift` | boolean | 是否有生日礼 |
| `onSale` | boolean | 是否启用 |

### 3.3 `cardTypes` — 次卡项目

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 剪发次卡 |
| `times` | number | 总次数，如 `12` |
| `price` | number | 售价（分） |
| `validDays` | number | 有效天数，如 `365` |
| `onSale` | boolean | 是否上架 |
| `sort` | number | 排序 |

### 3.4 `memberCards` — 会员持有的次卡

| 字段 | 类型 | 说明 |
|---|---|---|
| `memberId` | string | 指向 `members._id` |
| `cardTypeId` | string | 指向 `cardTypes._id` |
| `name` | string | 冗余存名称，避免联表 |
| `total` | number | 总次数 |
| `used` | number | 已用次数 |
| `expireAt` | Date | 到期时间 |
| `status` | string | `active` / `used_up` / `expired` |
| `createdAt` | Date | 购买时间 |

> `name` 冗余是刻意的：次卡项目改名或下架后，会员手里那张卡的历史名称不能跟着变。

### 3.5 `records` — 流水

| 字段 | 类型 | 说明 |
|---|---|---|
| `memberId` | string | |
| `type` | string | `consume` / `recharge` / `cardbuy` / `cardverify` |
| `amount` | number | 本次发生额（分） |
| `delta` | number | 余额变化，正为入、负为出 |
| `balanceAfter` | number | 操作后余额（分） |
| `items` | array | 核销明细 `[{name, price, qty}]` |
| `staffId` | string | 操作员工 |
| `remark` | string | |
| `createdAt` | Date | |

> **流水只追加，永不修改、永不删除。** 记错了就再记一笔冲正，不要 UPDATE。

### 3.6 `services` — 核销服务项

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 洗吹 / 剪发造型 / 染发 / 头皮护理 |
| `price` | number | 单价（分） |
| `onSale` | boolean | |
| `sort` | number | |

### 3.7 `config` — 门店配置

固定一条记录，`_id` 建议手写成 `shop`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `shopName` | string | 望京店 |
| `theme` | string | `blue` / `green` / ... |
| `pointRules` | object | `{ consume: 1, recharge: 0.5, sign: 5 }` |
| `rechargeTiers` | array | `[{amount: 50000, gift: 5000}]` |

---

## 第 4 步：建索引

在「数据库 → 集合 → 索引管理」里加。**索引不建，数据过万之后查询会明显变慢。**

| 集合 | 索引字段 | 类型 | 唯一 |
|---|---|---|---|
| `members` | `phone` | 升序 | ✅ 是 |
| `members` | `cardNo` | 升序 | ✅ 是 |
| `members` | `status` + `levelId` | 组合 | 否 |
| `members` | `lastVisitAt` | 降序 | 否 |
| `records` | `memberId` + `createdAt` | 组合（升序 + 降序） | 否 |
| `records` | `type` + `createdAt` | 组合 | 否 |
| `records` | `createdAt` | 降序 | 否 |
| `memberCards` | `memberId` | 升序 | 否 |
| `memberCards` | `expireAt` | 升序 | 否 |
| `levels` | `sort` | 降序 | 否 |
| `cardTypes` | `sort` | 升序 | 否 |

> **`phone` 必须建唯一索引**。这是防止同一个人被建两次的最后一道防线——前端校验能被绕过、并发能撞车，但数据库的唯一索引不会。

---

## 第 5 步：配权限（最容易出事的一步）

每个集合都有「数据权限」设置，四档：仅创建者可读写 / 所有用户可读、仅创建者可写 / 所有用户可读 / 仅管理端。

**默认设置全是坑**，按下面改：

| 集合 | 权限 | 理由 |
|---|---|---|
| `members` | **仅管理端可读写** | 会员的余额、手机号绝不能给前端直接改 |
| `records` | **仅管理端可读写** | 流水同理，前端只能读自己的汇总 |
| `memberCards` | **仅管理端可读写** | 次数扣减必须走云函数 |
| `levels` | 所有用户可读，仅管理端可写 | 等级规则需要前端展示 |
| `cardTypes` | 所有用户可读，仅管理端可写 | 同上 |
| `services` | 所有用户可读，仅管理端可写 | 同上 |
| `config` | 所有用户可读，仅管理端可写 | 主题、店名要读 |

「仅管理端可读写」的意思是：**小程序端一行代码都读不到，只能通过云函数访问**。这是对的——安全边界就在这。

如果你确实需要前端直接读（比如列表页想省一次云函数调用），可以给 `members` 开「所有用户可读」，但**必须同时写安全规则**限制返回字段：

```json
{
  "read": "doc.status != 'disabled'",
  "write": false
}
```

不过更推荐的做法是：**全部走云函数**。多一次调用换一个干净的安全模型，值得。

---

## 第 6 步：灌初始数据

### 6.1 简单办法：控制台手动加

数据量小（比如几个等级、几个次卡项目、几个服务项）直接在控制台「添加记录」逐条加。适合 `levels`、`cardTypes`、`services`、`config`。

### 6.2 批量办法：导入 JSON

控制台支持导入 JSON Lines 格式（**不是标准 JSON**，每行一个对象，不能有逗号）：

```json
{"_id":"level-black","name":"黑金卡","sort":4,"rechargeThreshold":500000,"consumeThreshold":800000,"discount":0.85,"pointRate":2,"birthdayGift":true,"onSale":true}
{"_id":"level-gold","name":"金卡","sort":3,"rechargeThreshold":200000,"consumeThreshold":300000,"discount":0.9,"pointRate":1.5,"birthdayGift":true,"onSale":true}
{"_id":"level-silver","name":"银卡","sort":2,"rechargeThreshold":50000,"consumeThreshold":80000,"discount":0.95,"pointRate":1,"birthdayGift":false,"onSale":true}
{"_id":"level-normal","name":"普通","sort":1,"rechargeThreshold":0,"consumeThreshold":0,"discount":1,"pointRate":1,"birthdayGift":false,"onSale":true}
```

手写 `_id`（像上面这样给语义化 ID）比自动生成的随机串好用得多，云函数里可以直接引用。

### 6.3 写个一次性初始化云函数

数据多了（比如要造 100 个测试会员），写个 `init` 云函数，跑完就删掉：

```js
// cloudfunctions/init/index.js —— 跑完请删除，别部署到生产
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const levels = [
    { _id: 'level-gold', name: '金卡', sort: 3, discount: 0.9, pointRate: 1.5 },
    { _id: 'level-normal', name: '普通', sort: 1, discount: 1, pointRate: 1 }
  ]
  for (const l of levels) {
    await db.collection('levels').doc(l._id).set({ data: l })
  }

  // 造测试会员
  for (let i = 0; i < 50; i++) {
    await db.collection('members').add({
      data: {
        phone: '138' + String(10000000 + i).slice(-8),
        name: '测试' + i,
        balance: 100000,
        points: 0,
        levelId: 'level-normal',
        status: 'normal',
        tags: [],
        joinedAt: new Date(),
        createdAt: new Date()
      }
    })
  }
  return { ok: true }
}
```

---

## 第 7 步：写第一个云函数

先做 `member`，因为它没有金额逻辑，最容易跑通。

### 7.1 目录结构

```
miniapp/cloudfunctions/
├── member/
│   ├── index.js
│   └── package.json
├── recharge/
├── verify/
├── card/
├── stats/
├── level/
└── point/
```

每个云函数自己一个 `package.json`：

```json
{
  "name": "member",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

> 依赖**只写 `wx-server-sdk`**。云开发运行环境自带 Node，别装一堆没用的。

### 7.2 `member` 云函数完整实现

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

exports.main = async (event) => {
  const { action } = event
  const handlers = { list, detail, create, update, findByPhone, remove }
  if (!handlers[action]) {
    return { ok: false, msg: '未知操作: ' + action }
  }
  try {
    const data = await handlers[action](event, db, _, $)
    return { ok: true, data }
  } catch (e) {
    console.error(action, e)
    return { ok: false, msg: e.message }
  }
}

// 列表：支持关键词、等级、状态、分页
async function list({ keyword, levelId, status, page = 1, size = 20 }, db, _) {
  const where = {}

  if (keyword) {
    // 手机后四位 / 完整手机号 / 卡号 / 姓名
    where.$or = [
      { phone: db.RegExp({ regexp: keyword, options: 'i' }) },
      { cardNo: db.RegExp({ regexp: keyword, options: 'i' }) },
      { name: db.RegExp({ regexp: keyword, options: 'i' }) }
    ]
  }
  if (levelId) where.levelId = levelId
  if (status) where.status = status

  const res = await db.collection('members')
    .where(where)
    .orderBy('lastVisitAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get()

  const count = await db.collection('members').where(where).count()

  return { list: res.data, total: count.total, page, size }
}

// 详情：会员 + 持有的次卡
async function detail({ id }, db) {
  const member = await db.collection('members').doc(id).get()
  const cards = await db.collection('memberCards')
    .where({ memberId: id })
    .orderBy('createdAt', 'desc')
    .get()
  return { member: member.data, cards: cards.data }
}

// 精确查人：手机号 / 卡号
async function findByPhone({ phone, cardNo }, db) {
  const key = phone ? { phone } : { cardNo }
  const res = await db.collection('members').where(key).limit(1).get()
  return res.data[0] || null
}

// 建档
async function create({ payload }, db) {
  const now = new Date()

  // 手机号唯一性前置检查（唯一索引是最后防线，这里先给友好提示）
  const dup = await db.collection('members').where({ phone: payload.phone }).count()
  if (dup.total > 0) throw new Error('该手机号已存在')

  // 卡号：QH + 4 位序号
  const seq = await db.collection('members').count()
  const cardNo = 'QH' + String(seq.total + 1).padStart(4, '0')

  const doc = {
    ...payload,
    cardNo,
    balance: payload.balance || 0,
    points: 0,
    totalRecharge: payload.balance || 0,
    totalConsume: 0,
    tags: payload.tags || [],
    status: 'normal',
    joinedAt: now,
    lastVisitAt: now,
    createdAt: now,
    updatedAt: now
  }
  const res = await db.collection('members').add({ data: doc })

  // 初始余额 > 0 时，生成一笔充值流水
  if (doc.balance > 0) {
    await db.collection('records').add({
      data: {
        memberId: res._id,
        type: 'recharge',
        amount: doc.balance,
        delta: doc.balance,
        balanceAfter: doc.balance,
        items: [],
        remark: '开卡初始余额',
        createdAt: now
      }
    })
  }

  return { id: res._id, cardNo }
}

// 编辑
async function update({ id, payload }, db) {
  const data = { ...payload, updatedAt: new Date() }
  delete data.balance        // 余额只能通过充值/核销改
  delete data.points
  delete data.cardNo
  delete data._id

  await db.collection('members').doc(id).update({ data })
  return { id }
}

async function remove({ id }, db) {
  // 真删会破坏流水完整性，这里只做停用
  await db.collection('members').doc(id).update({
    data: { status: 'disabled', updatedAt: new Date() }
  })
  return { id }
}
```

### 7.3 部署

右键 `cloudfunctions/member` → 「上传并部署：云端安装依赖」。
第一次要等 1-2 分钟装依赖。之后改代码再部署，几秒。

---

## 第 8 步：前端接上

### 8.1 封装一层调用

新建 `miniapp/utils/api.js`：

```js
const call = (name, action, data = {}) => {
  return wx.cloud.callFunction({ name, data: { action, ...data } })
    .then(res => {
      const r = res.result || {}
      if (!r.ok) throw new Error(r.msg || '请求失败')
      return r.data
    })
}

module.exports = {
  member: {
    list: (params) => call('member', 'list', params),
    detail: (id) => call('member', 'detail', { id }),
    create: (payload) => call('member', 'create', { payload }),
    update: (id, payload) => call('member', 'update', { id, payload }),
    findByPhone: (params) => call('member', 'findByPhone', params)
  },
  recharge: {
    submit: (params) => call('recharge', 'submit', params)
  },
  verify: {
    submit: (params) => call('verify', 'submit', params)
  },
  stats: {
    summary: (range) => call('stats', 'summary', { range })
  }
}
```

### 8.2 改一个页面试试

以会员列表 `miniapp/pages/members/members.js` 为例：

```js
const api = require('../../utils/api')

Page({
  data: {
    theme: 'blue',
    state: 'default',
    inputs: {},
    selected: 'members',
    list: [],
    total: 0,
    loading: true
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme })
    this.loadList()
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const res = await api.member.list({
        keyword: this.data.inputs.f0 || '',
        page: 1,
        size: 20
      })
      this.setData({ list: res.list, total: res.total, loading: false })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`inputs.${key}`]: e.detail.value })
  },

  onSearch() {
    this.loadList()
  }
})
```

WXML 里把写死的 `<view class="cell">` 换成 `<block wx:for="{{list}}" wx:key="_id">`，字段用 `item.name`、`item.phone`。

**金额显示**记得除 100：

```js
formatMoney: (fen) => (fen / 100).toFixed(2)
```

---

## 第 9 步：钱相关操作的正确写法

这是整个后端最不能出错的地方。**三条铁律：**

### 铁律一：所有金额写库必须走云函数

小程序端没有任何权限改 `balance`。前端就算被反编译，也改不了钱。

### 铁律二：用 `_.inc()` 原子自增，不要「先读再写」

❌ 错误写法（并发时会丢更新）：

```js
const m = await db.collection('members').doc(id).get()
const newBalance = m.data.balance + amount
await db.collection('members').doc(id).update({ data: { balance: newBalance } })
```

两个店员同时核销，都读到 1000，都写 900，实际扣了一次钱。

✅ 正确写法：

```js
await db.collection('members').doc(id).update({
  data: {
    balance: _.inc(-amount),
    totalConsume: _.inc(amount),
    lastVisitAt: new Date()
  }
})
```

数据库层面原子加减，不会丢。

### 铁律三：跨集合的操作要用事务

比如「余额核销」要同时改 `members.balance` 和插 `records`，中间失败会导致余额扣了但没流水。

```js
// cloudfunctions/verify/index.js
exports.main = async (event) => {
  const { memberId, amount, items, type } = event
  const transaction = await db.startTransaction()

  try {
    const m = await transaction.collection('members').doc(memberId).get()
    const balance = m.data.balance

    if (amount > balance) {
      throw new Error('余额不足，当前余额 ' + (balance / 100).toFixed(2))
    }

    const after = balance - amount

    await transaction.collection('members').doc(memberId).update({
      data: {
        balance: _.inc(-amount),
        totalConsume: _.inc(amount),
        lastVisitAt: new Date()
      }
    })

    await transaction.collection('records').add({
      data: {
        memberId,
        type: type || 'consume',
        amount,
        delta: -amount,
        balanceAfter: after,
        items: items || [],
        createdAt: new Date()
      }
    })

    await transaction.commit()
    return { ok: true, data: { balanceAfter: after } }
  } catch (e) {
    await transaction.rollback()
    return { ok: false, msg: e.message }
  }
}
```

> **事务里不能用 `where` 查询**，只能 `doc(id)` 精确取。所以会员 ID 必须由前端传进来，不能靠查询定位。

### 次卡核销的事务写法

```js
// 扣次数：先查剩余，再原子减
const card = await transaction.collection('memberCards').doc(cardId).get()
const left = card.data.total - card.data.used
if (left < 1) throw new Error('该次卡次数已用完')

await transaction.collection('memberCards').doc(cardId).update({
  data: {
    used: _.inc(1),
    status: left - 1 === 0 ? 'used_up' : 'active'
  }
})
```

---

## 第 10 步：统计怎么做

工作台和「数据」页需要今日 / 本周 / 本月的聚合。**不要在前端拉全量数据自己算**——数据一多就卡死，而且流量费很贵。

用聚合查询在数据库端算：

```js
// cloudfunctions/stats/index.js
const getRange = (range) => {
  const now = new Date()
  const start = new Date(now)
  if (range === 'day') {
    start.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }
  return { start, end: now }
}

async function summary({ range }) {
  const { start, end } = getRange(range)
  const res = await db.collection('records')
    .aggregate()
    .match({ createdAt: _.gte(start).and(_.lte(end)) })
    .group({
      _id: '$type',
      total: $.sum('$amount'),
      count: $.sum(1)
    })
    .end()

  const out = { revenue: 0, recharge: 0, cardSold: 0, verifyCount: 0 }
  for (const r of res.list) {
    if (r._id === 'consume') { out.revenue = r.total; out.verifyCount = r.count }
    if (r._id === 'recharge') out.recharge = r.total
    if (r._id === 'cardbuy') out.cardSold = r.count
    if (r._id === 'cardverify') out.verifyCount += r.count
  }
  return out
}
```

趋势图按天分组：

```js
.group({
  _id: $.dateToString({ date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Shanghai' }),
  total: $.sum('$amount')
})
.sort({ _id: 1 })
```

> `timezone` 一定要写 `Asia/Shanghai`，不写会按 UTC 分组，晚上 8 点之后的单子会算到「昨天」。

---

## 常见坑

### 1. `touristappid` 用不了云开发

`project.config.json` 里的 `touristappid` 是游客模式，没有云环境。先在微信公众平台拿到正式 AppID 再换。

### 2. 免费环境发布后 15 天过期

本地开发时一切正常，一发布就报「环境不存在」。要么在发布前转付费，要么接受上线 15 天后断掉。**演示项目要注意这点。**

### 3. 云函数改了代码但没生效

必须**重新上传部署**。本地改文件不会自动同步到云端。

### 4. `where` 查不到数据但控制台能看到

九成是权限问题。集合设成「仅管理端可读写」后，前端 `db.collection().get()` 会返回空数组**而不是报错**，非常容易误判成「没数据」。

### 5. 日期存成了字符串

`new Date()` 存进去是 Date 类型，但如果从 JSON 导入，会变成字符串，之后 `_.gte()` 比较就失效。导入时注意格式。

### 6. 云函数超时

默认 3 秒，批量写数据很容易超。在云开发控制台「云函数 → 配置」里调到 20 秒。

### 7. 索引没建，数据过千就慢

`members.phone` 的唯一索引一定要建，否则查手机号是全表扫描。

---

## 做完之后的检查清单

- [ ] 7 个集合都建好了，名字和文档一致
- [ ] `members.phone`、`members.cardNo` 建了唯一索引
- [ ] `members`、`records`、`memberCards` 权限设为「仅管理端可读写」
- [ ] `levels`、`cardTypes`、`services`、`config` 灌了初始数据
- [ ] `member` 云函数部署成功，能在控制台「云端测试」里跑通 `list`
- [ ] 前端 `utils/api.js` 封装好了
- [ ] 至少一个页面（会员列表）换成了真实数据
- [ ] 金额全部以「分」存储，展示时除 100
- [ ] 涉及余额的操作都走云函数 + 事务
- [ ] 余额更新用的是 `_.inc()`，没有「先读再写」
- [ ] 统计的聚合查询带了 `timezone: 'Asia/Shanghai'`
- [ ] `init` 这类一次性函数没留在生产环境

全部打勾，后端就算接完了。

---

## 参考

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [数据库 API](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/database.html)
- [数据库事务](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/Database.startTransaction.html)
- [计费说明](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/billing/price.html)
