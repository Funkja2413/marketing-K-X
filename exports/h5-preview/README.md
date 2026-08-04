# H5 活动预览独立工程

这个目录只包含活动 H5，不包含 Chat、Canvas、右侧配置器和 `/studio`。

## 直接独立运行

要求 Node.js 20.9 或更高版本。

```bash
pnpm install
pnpm dev
```

浏览器打开：<http://localhost:3000>

生产构建：

```bash
pnpm build
pnpm start
```

## 放进另一个 Next.js 项目

复制以下目录：

```text
components/campaign/
styles/campaign.css
public/figma/
public/theme-assets/
public/og-night.webp
```

在目标项目的全局 Layout 中引入：

```tsx
import "../styles/campaign.css";
```

在需要展示活动的页面中使用：

```tsx
import { CampaignExperience } from "@/components/campaign/CampaignExperience";

export default function CampaignPage() {
  return <CampaignExperience />;
}
```

如果要放在 `/campaign` 路由，可将上面页面保存为 `app/campaign/page.tsx`。

## 默认行为

- 页面默认使用“夏天马上顺”主题。
- 抽卡进度保存在目标站点自己的 localStorage 中。
- 配置器本地 IndexedDB 中临时上传、但尚未写入源码或公共素材目录的文件不会自动跨域迁移。
- 当前工程内置的 Hero 首尾帧、道具卡、内容卡和品牌素材已经包含在 `public/` 中。
