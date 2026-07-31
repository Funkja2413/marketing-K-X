# Campaign Skin Studio

`/studio` 是现有活动 H5 的换肤配置工具。它复用同一个
`CampaignExperience` 渲染器，因此配置预览与活动页不会维护两套 UI。

## 使用流程

1. 从“夏天马上顺”或“夏日夜食”创建方案，也可以复制当前方案。
2. 上传 Hero 图片或视频，调整 `cover / contain` 与焦点位置。
3. 修改核心品牌色、活动文案、9 张卡片和 4 档奖励。
4. 在中间的 375px 手机窗口实时检查结果。
5. 点击“应用到活动页”，刷新活动页查看当前浏览器中的效果。
6. 导出 JSON 作为主题包备份或交付文件。

配置草稿与玩家活动进度使用不同的存储键：

- 配置草稿：`campaign-studio-drafts-v1`
- 当前应用皮肤：`campaign-active-skin-v1`
- 玩家进度：`summer-campaign-multitheme-v2`

重置玩家体验不会删除皮肤配置，恢复主题默认值也不会清空玩家进度。

## 当前模板约束

第一版以稳定换肤为目标，页面几何不进入普通配置：

- Hero 媒体槽：375 × 460
- 卡片：9 张
- 奖励：4 档
- 任务：5 个
- 话题标签：6 个
- 灵感卡：3 个
- 内容卡：4 个
- 活动 Banner：2 个

配置器会检查 Hero、卡片数量、奖励数量、标签数量、Banner 数量和奖励门槛。
若要改变槽位数量或页面结构，应新增模板 preset，而不是在 Theme Pack 中改几何。

## JSON 结构

每个导出的方案包含：

- `version`：配置版本
- `id / name / baseTheme`
- `content`：运营文案、卡片、任务、奖励与内容模块
- `pack.assets`：Hero、地图、奖励、按钮和卡框素材
- `pack.colors`：活动页使用的语义色 token
- `updatedAt`

上传的本地素材会以 Data URL 进入当前草稿，便于即时预览。大素材可能超过浏览器
本地存储容量，正式生产应将素材上传到对象存储，再在 JSON 中保存稳定 URL。
