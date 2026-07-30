import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#24120d",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "今晚开饭｜夏夜九味收藏计划",
    description: "做任务、抽夜宵卡、集齐九味，领取夏夜好券。",
    icons: {
      icon: `${origin}/og.png`,
    },
    openGraph: {
      title: "今晚开饭｜夏夜九味收藏计划",
      description: "做任务 · 抽夜宵 · 赢好券",
      url: origin,
      siteName: "今晚开饭",
      locale: "zh_CN",
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1753,
          height: 909,
          alt: "今晚开饭夏夜集卡活动",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "今晚开饭｜夏夜九味收藏计划",
      description: "做任务 · 抽夜宵 · 赢好券",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
