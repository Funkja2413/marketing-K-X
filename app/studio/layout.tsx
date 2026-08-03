import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 工坊｜H5 配置编辑器",
  description:
    "在同一创作工作台中完成活动 H5 的对话生成、画布预览与模块配置。",
};

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
