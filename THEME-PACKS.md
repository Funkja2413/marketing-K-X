# CampaignStage 主题包使用说明

`CampaignStage` 是活动首屏的统一容器。顶部占位、Hero、主题 Tab、主操作按钮、奖励档位和收集卡槽都由同一套组件与共享 CSS 负责排版。

主题包只负责两类内容：

- 素材：Hero、顶部装饰和终极奖励图。
- 视觉 Token：页面、面板、按钮、Tab、卡槽等颜色。

主题包不得定义组件高度、宽度、比例、间距、栅格或定位。这样切换主题时，页面结构与触控区域不会发生变化。

当前入口：

- 统一组件：`app/campaign-stage.tsx`
- 主题包配置：`app/campaign-theme-packs.ts`
- 主题素材：建议放在 `public/theme-assets/<theme-id>/`

## 只替换一张素材

将新文件放进 `public`，然后只修改对应主题包中的素材路径。

例如替换 Night 的 Hero：

```ts
night: {
  assets: {
    heroImage: "/theme-assets/night/hero-scene-v2.webp",
  },
  colors: {
    // 保持原 Token 不变
  },
}
```

替换后不需要修改 `CampaignStage`、页面 JSX 或共享 CSS。

可单独替换的素材字段：

```ts
assets: {
  topCapImage?: string;
  heroImage: string;
  grandRewardImage?: string;
  rewardShelfImage?: string;
  actionButtonImage?: string;
  tierFrameImage?: string;
  cardOwnedFrameImage?: string;
  cardMissingFrameImage?: string;
}
```

- `topCapImage` 可省略。省略后，顶部槽位仍然保留，由 `topCapBackground` 填充，不会改变页面高度。
- `heroImage` 是必填项。
- `grandRewardImage` 可省略；它用于终极奖励档位的透明底奖品图。
- 其余 `*Image` 字段是整套 UI 框体素材，可按需提供；省略时自动使用颜色 Token 生成的默认 UI。

素材更新后需要同时检查：

1. 路径以 `/` 开头，并且对应文件确实位于 `public` 下。
2. 图片没有把按钮、Tab、奖励数字等动态内容烘焙进去。
3. Hero 的标题、副标题和活动主视觉已经合并在同一张 Hero 图中。
4. 在常见手机宽度下确认主体没有落入按钮、Tab 等交互覆盖区。

## 批量替换整套 UI 皮肤

整套换肤时，在 `THEME_PACKS` 中新增或替换一个完整的 `CampaignThemePack`。不要复制组件，也不要新增主题专属布局选择器。

```ts
const newSkin: CampaignThemePack = {
  assets: {
    topCapImage: "/theme-assets/new-skin/top-cap.webp",
    heroImage: "/theme-assets/new-skin/hero.webp",
    grandRewardImage: "/theme-assets/new-skin/grand-reward.webp",
    rewardShelfImage: "/theme-assets/new-skin/reward-shelf.webp",
    actionButtonImage: "/theme-assets/new-skin/action-button.webp",
    tierFrameImage: "/theme-assets/new-skin/tier-frame.webp",
    cardOwnedFrameImage: "/theme-assets/new-skin/card-owned-frame.webp",
    cardMissingFrameImage: "/theme-assets/new-skin/card-missing-frame.webp",
  },
  colors: {
    page: "#...",
    topCapBackground: "#...",
    heroBackground: "#...",
    surface: "#...",
    surfaceText: "#...",
    mutedText: "#...",
    accent: "#...",
    accentText: "#...",
    actionStart: "#...",
    actionEnd: "#...",
    actionShadow: "#...",
    sideAction: "#...",
    sideActionText: "#...",
    tabSurface: "#...",
    tabText: "#...",
    tabActiveSurface: "#...",
    tabActiveText: "#...",
    cardBorder: "#...",
    cardOwned: "#...",
    cardMissing: "#...",
    countBadge: "#...",
  },
};
```

推荐使用独立素材目录：

```text
public/
└── theme-assets/
    └── new-skin/
        ├── top-cap.webp
        ├── hero.webp
        ├── grand-reward.webp
        ├── reward-shelf.webp
        ├── action-button.webp
        ├── tier-frame.webp
        ├── card-owned-frame.webp
        ├── card-missing-frame.webp
        └── cards/
            ├── card-01.webp
            ├── card-02.webp
            └── ...
```

批量换肤的原则：

- 通过主题包替换图片和颜色 Token。
- 保留同一个 `CampaignStage` DOM。
- 保留相同的 Tab、按钮、奖励和卡槽触控区域。
- 状态文案、数量、领取状态仍由 React 渲染，不能写进背景图。
- 若一批皮肤共用同样的颜色或素材，可在配置文件中先声明公共对象，再由多个主题复用。

## 素材规范

### Top Cap

- 推荐导出尺寸：`1125 × 234`
- 页面显示比例：`375 : 78`
- 可以是 PNG、WebP 或 AVIF。
- 可以不提供图片，但固定的 Top Cap 槽位仍会存在。
- 不提供图片时使用 `colors.topCapBackground`。
- 不要通过删除槽位来缩短某一个主题的页面。

### Hero

- 标准导出尺寸：`1125 × 1125`
- 页面显示比例：`1 : 1`
- 标题、副标题、活动日期和主视觉建议在设计侧合成为一张图片。
- 不要提交横版 OG 图再依赖 `object-fit: contain` 或模糊背景补边。
- 关键人物、Logo 和文字应避开 Tab、右侧分享/规则入口以及底部主操作区。

### 收集卡

- 标准导出尺寸：`180 × 180`
- 必须使用透明底。
- 每张卡的主体尽量保持相近的视觉占比与重心。
- 图片只包含卡片物件本身；已获得边框、未获得遮罩、数量角标和卡名由共享 UI 绘制。
- 推荐使用 WebP 或 PNG，避免带大面积空白。

### 奖励图

- 使用透明底 PNG 或 WebP。
- 奖品主体在画布中居中，并保留少量安全边距。
- 不要把“已领取”“未解锁”、门槛数量或优惠金额写入图片。
- 终极奖励图通过 `grandRewardImage` 配置；普通优惠券的金额继续由组件实时渲染。

## 几何维护规则

以下内容只能在 `CampaignStage` 或它的共享 CSS 中维护：

- Top Cap、Hero、按钮栏和奖励面板的高度与比例。
- Tab、分享/规则入口和主按钮的位置。
- 左右入口与主按钮的列宽。
- 奖励档位数量对应的栅格布局。
- 收集卡槽的尺寸、间距和滚动方式。
- 圆角、内部留白、断点和安全区处理。

主题包中只允许放：

- 图片路径。
- 背景色、文字色、边框色、按钮渐变色等视觉 Token。

禁止在主题包或主题专属选择器中放：

```css
height
width
aspect-ratio
grid-template-columns
gap
top
right
bottom
left
margin
padding
transform
```

特别不要重新引入以下形式的布局覆盖：

```css
.theme-summer .hero { /* 主题专属尺寸 */ }
.theme-night .campaign-action-bar { /* 主题专属定位 */ }
.theme-new .campaign-reward-shelf { /* 主题专属排版 */ }
```

如果新素材无法适配现有槽位，应先在设计工具中按素材规范重新构图和导出。只有所有主题都需要改变结构时，才统一修改 `CampaignStage` 与共享 CSS。

## 上线前检查

- 两个主题的 Top Cap、Hero、按钮栏和奖励面板占位完全一致。
- 切换 Tab 时页面主体没有上下跳动。
- 主按钮、左右入口、分享和规则按钮都可以点击。
- Hero 无拉伸、无补边、无文字被裁切。
- 收集卡在已获得、未获得和重复卡角标状态下都没有溢出。
- 奖励档位的未解锁、可领取和已领取状态清晰可辨。
- 新主题没有新增任何影响几何的 `.theme-*` CSS。
