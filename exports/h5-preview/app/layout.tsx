import type { Metadata, Viewport } from "next";
import "../styles/campaign.css";

export const metadata: Metadata = {
  title: "暑期好运季｜夏天马上顺",
  description: "做任务、抽装备、收集好运并赢取好券。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#18acee",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
