# 云开发后端接入指南

这份文档写的是**从零把微信云开发接进这个项目**的完整步骤。

> 说明：本项目已经内置本地存储与云同步（见 [SYNC.md](SYNC.md)），**不接云也能完整使用**。
> 这份文档讲的是怎么把云端备份真正开起来——开环境、建集合、配权限、部署云函数。
>
> 如果你只想要「能跑起来看」，跳过本文即可。想要「换手机数据不丢、多端同步」，再往下看。

> 预计耗时：环境开通 10 分钟，建集合与权限 20 分钟，跑通同步 30 分钟。
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
- [第 7 步：部署同步云函数](#第-7-步部署同步云函数)
- [第 8 步：前端接上](#第-8-步前端接上)
- [第 9 步：钱相关操作的正确写法](#第-9-步钱相关操作的正确写法)（进阶）
- [第 10 步：统计怎么做](#第-10-步统计怎么做)（进阶）
- [常见坑](#常见坑)
- [做完之后的检查清单](#做完之后的检查清单)

---

## 第 0 步：先想清楚要不要走这一步

云开发不是免费的。官方现在的规则是：

- **免费体验环境**：每个账号 1 个，每月 3000 资源点，单次可续 6 个月
- **免费环境在小程序发布后会变成「上线后第 15 天到期」**，之后必须转付费
- **基础套餐 19.9 元/月**（原价 39 元，5 折长期有效）

也就是说：**自己玩、做演示，免费额度够用；真上线给店里用，按 20 元/月左右预算。**

不接云也能完整使用——数据存在本机，关掉小程序再打开还在，断网也不影响。接云的意义只有两个：

1. **换手机 / 重装小程序数据不丢**
2. **多台设备看到同一份数据**

如果你不介意数据只在这台手机上，可以跳过本文。要接的话，下面的顺序不要跳。

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

### 6.3 最省事的办法：让小程序自己推上去

**推荐这条路。** 项目首次启动时会在本地灌入一套示例数据（`utils/seed.js`），配好云环境后会自动同步到云端，不需要手动灌。

如果你想要一套干净的初始数据（不要示例会员）：

1. 打开小程序 → 管理页 → 「清空本地数据」
2. 然后按 6.1 手动加等级、次卡项目、服务项、门店配置
3. 让小程序同步一次，这些数据会自动推上云

数据量特别大（比如要造 100 个测试会员）时，才需要下面这个一次性云函数：

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

> 注意：手写的这些记录**没有 `updatedAt` 和 `rev`**，同步时会被当成旧数据。如果要用它们，记得同时写 `updatedAt: Date.now(), rev: 1`，否则 `pull` 的增量查询拉不到。

---

## 第 7 步：部署同步云函数

项目内置的云函数只有一个：`cloudfunctions/sync`，负责本地与云端的双向同步。不需要你写代码，直接部署即可。

### 7.1 它做什么

```
miniapp/cloudfunctions/sync/
├── index.js       push / pull / ping 三个 action
└── package.json   只依赖 wx-server-sdk
```

| action | 作用 |
|---|---|
| `push` | 把本地发件箱里的一条操作写进云数据库（upsert 或软删除） |
| `pull` | 按 `updatedAt` 增量拉取某个集合的变更，单次最多 100 条 |
| `ping` | 健康检查，返回服务端时间 |

### 7.2 部署

1. 在微信开发者工具里，`miniapp/project.config.json` 已经配好 `"cloudfunctionRoot": "cloudfunctions/"`
2. 右键 `cloudfunctions/sync` 目录
3. 选「上传并部署：云端安装依赖」
4. 第一次要等 1-2 分钟装 `wx-server-sdk`，之后改代码再部署只要几秒

### 7.3 验证

部署完成后，在云开发控制台 →「云函数」→ 找到 `sync` → 「云端测试」，输入：

```json
{ "action": "ping" }
```

返回 `{"ok": true, "data": {"serverTime": 1732626000000}}` 就通了。

### 7.4 安全边界

云函数里已经写死两道限制，部署后自动生效：

```js
// 只允许操作这 7 个集合，防止客户端乱写
const COLLS = ['members','records','memberCards','levels','cardTypes','services','config']

// 流水不允许客户端直接写（必须走业务逻辑）
const NO_DIRECT_WRITE = ['records']
```

服务端会覆盖客户端带来的 `updatedAt`、`rev`、`_deleted`，**以服务端时间和版本为准**，避免各端时钟不一致导致同步错乱。

---

## 第 8 步：前端接上

**不用改代码。** 前端已经接好了，做完第 7 步只剩一件事：把环境 ID 填进去。

### 8.1 填环境 ID

打开 `miniapp/app.js`：

```js
App({
  globalData: {
    theme: 'blue',
    env: 'qingyang-dev-8gxxxxx'   // ← 换成第 1 步拿到的环境 ID
  },
  ...
})
```

### 8.2 重启小程序

设置页的同步卡片会从「本地存储 · 灰点」变成「已连接云端 · 绿点」。

首页底部那行小字也会变成 `已同步云端 · 08:32`。

### 8.3 验证双向同步

1. 在小程序里建一个会员、充一笔钱
2. 打开云开发控制台 →「数据库」→ `members`，应该能看到刚建的记录
3. 在控制台手动改一条记录的 `updatedAt`（改大一点）
4. 回小程序下拉刷新，能看到改动同步回来

### 8.4 如果没生效

| 现象 | 原因 |
|---|---|
| 设置页仍显示「本地存储」 | `env` 没填或填错；看控制台 Network 有没有报错 |
| 显示「云端不可用」 | 云函数没部署，或没用正式 AppID |
| 数据上不去云 | 集合没建，或集合权限配成了「所有用户可读写」但规则挡住 |
| 数据下不来 | 拉取游标不对，可在设置页点「重连云端」强制全量 |

---

## 第 9 步：钱相关操作的正确写法（进阶）

> 做完第 8 步，云同步已经能用了。这一节和下一节属于**进阶改造**：
> 当前版本用「本地计算 + 同步」的方式记账，在单台设备上完全正确；
> 但多台设备**同时**改同一个会员的余额时，后写的会覆盖前写的（详见 [SYNC.md](SYNC.md) 第四节）。
>
> 如果要支持多店员同时操作，按本节把金额操作搬进云函数事务。

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

## 第 10 步：统计怎么做（进阶）

> 当前版本统计在本地算（`biz.js` 的 `summary` / `dailyRevenue`），单店数据量下完全够用。
> 这一节是数据量上万、或者想让多端看到一致统计时的改造方案。

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

**必需（做完这些云同步就能用）**

- [ ] 7 个集合都建好了，名字和文档一致
- [ ] `members.phone`、`members.cardNo` 建了唯一索引
- [ ] `members`、`records`、`memberCards` 权限设为「仅管理端可读写」
- [ ] `levels`、`cardTypes`、`services`、`config` 设为「所有用户可读，仅管理端可写」
- [ ] `sync` 云函数部署成功，控制台「云端测试」跑 `{"action":"ping"}` 返回 ok
- [ ] `miniapp/app.js` 的 `globalData.env` 填了环境 ID
- [ ] 设置页显示「已连接云端 · 绿点」
- [ ] 建一个会员，云开发控制台 `members` 集合里能看到这条记录

**进阶（要支持多店员同时操作才需要）**

- [ ] 涉及余额的操作走云函数 + 事务
- [ ] 余额更新用的是 `_.inc()`，没有「先读再写」
- [ ] 统计的聚合查询带了 `timezone: 'Asia/Shanghai'`
- [ ] `init` 这类一次性函数没留在生产环境

前三项打勾 = 云端备份可用。
全部打勾 = 能支撑多人同时操作。

---

## 参考

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [数据库 API](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/database.html)
- [数据库事务](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/Database.startTransaction.html)
- [计费说明](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/billing/price.html)
