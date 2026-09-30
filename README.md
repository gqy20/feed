# feed

Trail 扩展的采集发布仓库：抓取到的公开内容以 `data/posts.json` 为数据本体，`rss/` 提供订阅源，`index.html` 是静态时间线页。由 GitHub Pages 直接分发，无服务端、无构建步骤。

## 结构

```
data/posts.json   数据本体（DB of record），按 id 去重，历史封顶
data/meta.json    各渠道最近发布状态（展示用副本）
rss/all.xml       合并订阅源
rss/<平台>/<账号>.xml   单账号订阅源
index.html        时间线页：fetch data/posts.json 客户端渲染
```

## 写入规则

- **唯一写入方是 Trail 扩展的发布模块**（通过 GitHub Contents API 提交）。不要手工编辑 `data/` 和 `rss/` 下的文件——下一次发布会整体重写。
- 数据契约见 `data/posts.json` 的 `schema` 字段（当前为 `1`）。字段说明：`id` 为 `平台:原站内容id` 复合主键，`created_at` 是原帖时间（不是抓取时间）。
- 单写入方假设：只有一台浏览器写这个仓库，不考虑并发冲突。

## 私密性

公共仓库的 Pages 对任何知道地址的人可读。若关注列表需要保密，把仓库设为私有并使用支持私有 Pages 的 GitHub 付费计划；扩展侧配置不变。

## 安全

发布用的 GitHub token 只保存在 Trail 扩展本地（`chrome.storage.local`），**永远不会也不应该出现在这个仓库里**。若意外提交过 token，立即在 GitHub 侧吊销。
