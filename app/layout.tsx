import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#18acee",
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
    title: "暑期好运季｜夏天马上顺",
    description: "两大暑期主题共用一套活动框架：做任务、抽卡收集、分档赢好券。",
    icons: {
      icon: `${origin}/figma/crops/hero-scene.webp`,
    },
    openGraph: {
      title: "暑期好运季｜夏天马上顺",
      description: "做任务 · 抽装备 · 收集好运 · 赢好券",
      url: origin,
      siteName: "暑期好运季",
      locale: "zh_CN",
      type: "website",
      images: [
        {
          url: `${origin}/figma/crops/hero-scene.webp`,
          width: 1125,
          height: 1125,
          alt: "夏天马上顺暑期收集活动",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "暑期好运季｜夏天马上顺",
      description: "做任务 · 抽装备 · 收集好运 · 赢好券",
      images: [`${origin}/figma/crops/hero-scene.webp`],
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
      <head>
        <link
          rel="preload"
          as="image"
          href="/figma/crops/hero-scene.webp"
          type="image/webp"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
