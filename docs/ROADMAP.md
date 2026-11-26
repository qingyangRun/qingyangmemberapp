# 路线图

当前进度：**界面层完成，后端未开始**。

## 阶段一：界面与原型 ✅

- [x] 14 屏界面设计（375×812，微信小程序画幅）
- [x] 静态 HTML 原型，页面互相链接，点得动
- [x] 设计变量体系 `tokens.css`
- [x] 6 套主题色（经典蓝 / 清样绿 / 雅紫 / 琥珀橙 / 玫瑰红 / 石墨黑）
- [x] 微信原生小程序代码，14 页全部注册
- [x] 自定义底部标签栏（工作台 / 会员 / 记录 / 数据 / 管理）

## 阶段二：云开发后端（下一步）

目标：把写死的示例数据换成真实读写。

### 数据库集合

| 集合 | 说明 | 关键字段 |
|---|---|---|
| `members` | 会员 | `phone` `name` `gender` `birthday` `levelId` `balance` `points` `tags[]` `status` `cardNo` `joinedAt` `lastVisitAt` |
| `levels` | 等级 | `name` `sort` `rechargeThreshold` `consumeThreshold` `discount` `pointRate` `birthdayGift` |
| `cardTypes` | 次卡项目 | `name` `times` `price` `validDays` `onSale` |
| `memberCards` | 会员持有的次卡 | `memberId` `cardTypeId` `total` `used` `expireAt` |
| `records` | 流水 | `memberId` `type` `amount` `delta` `balanceAfter` `items[]` `staffId` `createdAt` |
| `services` | 核销服务项 | `name` `price` `onSale` |
| `config` | 门店配置 | `shopName` `theme` `pointRules` |

### 云函数

| 函数 | 职责 |
|---|---|
| `member` | 建档 / 编辑 / 查询（按手机后四位、完整手机号、卡号）/ 分页筛选 |
| `recharge` | 充值下单、赠送计算、写流水、更新余额与累计充值 |
| `verify` | 余额核销 / 次卡核销 / 组合核销，事务内扣减 |
| `card` | 次卡购买、开卡、核销次数、过期检查 |
| `stats` | 今日 / 本周 / 本月聚合，按日汇总 |
| `level` | 等级自动升降（按累计充值 / 累计消费） |
| `point` | 积分发放与抵扣 |

### 要点

- 核销、充值这类涉及金额的操作必须走**云函数 + 数据库事务**，不能在前端直接写库
- 余额和累计消费的更新要用 `_.inc()` 原子操作，避免并发覆盖
- 流水记录不可改不可删，只追加

## 阶段三：账号与权限

- [ ] 微信登录（`wx.login` → `openid`）
- [ ] 角色：店主 / 店长 / 员工
- [ ] 员工权限：能否改价、能否送赠、能否删除记录
- [ ] 操作日志

## 阶段四：完善

- [ ] 真实数据渲染与下拉刷新、滚动分页
- [ ] 数据导出（Excel / CSV）
- [ ] 多门店支持
- [ ] 小票打印
- [ ] 订阅消息（生日提醒、次卡到期提醒）

## 不做

以下功能明确不在本项目范围，避免变成又一个重型 SaaS：

- 复杂的营销裂变（分销、拼团、砍价）
- 商品商城与物流
- 财务对账与发票
- 多租户 SaaS 平台化

保持「一家小店够用的会员系统」这个定位。
