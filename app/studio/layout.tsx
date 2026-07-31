import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "活动换肤配置器｜Campaign Skin Studio",
  description:
    "基于固定活动模板快速复制主题、替换 Hero、配色、运营文案、卡片与奖励素材。",
};

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
