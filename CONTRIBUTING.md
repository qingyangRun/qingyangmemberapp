# 贡献指南

## 环境

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版即可）
- 任意现代浏览器（跑 `design/` 静态原型）
- 不需要 Node.js，本项目没有构建步骤

## 跑起来

```
# 原型
浏览器打开 design/home.html

# 小程序
微信开发者工具 → 导入项目 → 选 miniapp/ 目录 → AppID 用测试号或自己的
```

## 改样式

**不要直接在页面的 `<style>` 或 `.wxss` 里写死颜色和字号。**

- 原型端：改 `design/tokens.css` 的 CSS 变量
- 小程序端：改 `miniapp/app.wxss` 里 `page { --xxx }` 的变量

共用组件（卡片、按钮、单元格、标签）的样式在 `design/app.css` 和 `miniapp/app.wxss` 里，页面文件只写这一屏特有的样式。

## 加页面

1. 在 `design/` 加一个 HTML，`<head>` 里带 `<meta name="dsh-design" content="miniprogram">`
2. 在 `miniapp/pages/<name>/` 加 4 个文件（`.wxml` `.wxss` `.js` `.json`）
3. 在 `miniapp/app.json` 的 `pages` 数组里注册
4. 别忘在页面 `js` 里补 `go` 跳转和 `onInput` 输入处理

## 代码约定

- **单位**：小程序端一律 `rpx`（1px ≈ 2rpx），原型端用 `px` + 变量
- **图标**：加进 `design/icons.svg` 的 `<symbol>`，小程序端在 `app.wxss` 里加对应的 `mask-image`
- **文案**：界面文案用中文，中英文之间留一个空格
- **示例数据**：只用虚构人名和脱敏手机号（`138 0000 0000`），不要用能对应到真人的信息
- **别加外链**：字体、图片、样式都不要连外网，离线要能正常显示

## 提交

- 一个 PR 做一件事，标题写清楚改了什么
- 涉及界面的改动附一张截图
- 大改动先开 Issue 聊方向，避免白做

## 许可

提交代码即表示同意以 [MIT](LICENSE) 协议发布。
