import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputRoot = path.join(repositoryRoot, "exports", "h5-preview");

async function ensureParent(targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

async function copy(relativeSource, relativeTarget = relativeSource) {
  const source = path.join(repositoryRoot, relativeSource);
  const target = path.join(outputRoot, relativeTarget);
  await ensureParent(target);
  await copyFile(source, target);
}

async function write(relativeTarget, contents) {
  const target = path.join(outputRoot, relativeTarget);
  await ensureParent(target);
  await writeFile(target, contents, "utf8");
}

async function copyDirectoryFiles(relativeDirectory) {
  const { readdir } = await import("node:fs/promises");
  const sourceDirectory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryFiles(relativePath);
    } else if (entry.isFile()) {
      await copy(relativePath);
    }
  }
}

const sourcePage = await readFile(
  path.join(repositoryRoot, "app", "page.tsx"),
  "utf8",
);
const campaignExperience = sourcePage.replace(
  /\nexport default function Home\(\) \{\n  return <CampaignExperience \/>;\n\}\s*$/,
  "\n",
);

const sourceCss = await readFile(
  path.join(repositoryRoot, "app", "globals.css"),
  "utf8",
);
const campaignCssSection = sourceCss.split(
  "/* Campaign Skin Studio */",
)[0];
const campaignCss = campaignCssSection
  .replace(/^@import "tailwindcss";\s*/, "")
  .replace(/^@font-face\s*\{[\s\S]*?\}\s*/, "")
  .trimStart();

await write(
  "components/campaign/CampaignExperience.tsx",
  campaignExperience,
);
await copy(
  "app/campaign-stage.tsx",
  "components/campaign/campaign-stage.tsx",
);
await copy(
  "app/campaign-theme-packs.ts",
  "components/campaign/campaign-theme-packs.ts",
);
await write("styles/campaign.css", campaignCss);

await copyDirectoryFiles("public/figma");
await copyDirectoryFiles("public/theme-assets");
await copy("public/og-night.webp");

await write(
  "app/page.tsx",
  `import { CampaignExperience } from "../components/campaign/CampaignExperience";

export default function HomePage() {
  return <CampaignExperience />;
}
`,
);

await write(
  "app/layout.tsx",
  `import type { Metadata, Viewport } from "next";
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
`,
);

await write(
  "package.json",
  `${JSON.stringify(
    {
      name: "campaign-h5-preview",
      version: "1.0.0",
      private: true,
      engines: { node: ">=20.9.0" },
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "16.2.6",
        react: "19.2.6",
        "react-dom": "19.2.6",
      },
      devDependencies: {
        "@types/node": "22.19.19",
        "@types/react": "19.2.14",
        "@types/react-dom": "19.2.3",
        typescript: "5.9.3",
      },
    },
    null,
    2,
  )}\n`,
);

await write(
  "tsconfig.json",
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: [
        "next-env.d.ts",
        "**/*.ts",
        "**/*.tsx",
        ".next/types/**/*.ts",
        ".next/dev/types/**/*.ts",
      ],
      exclude: ["node_modules"],
    },
    null,
    2,
  )}\n`,
);

await write(
  "next.config.ts",
  `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
);

await write(
  ".gitignore",
  `.next/
node_modules/
next-env.d.ts
*.tsbuildinfo
*.log
.DS_Store
`,
);

await write(
  "README.md",
  `# H5 活动预览独立工程

这个目录只包含活动 H5，不包含 Chat、Canvas、右侧配置器和 \`/studio\`。

## 直接独立运行

要求 Node.js 20.9 或更高版本。

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

浏览器打开：<http://localhost:3000>

生产构建：

\`\`\`bash
pnpm build
pnpm start
\`\`\`

## 放进另一个 Next.js 项目

复制以下目录：

\`\`\`text
components/campaign/
styles/campaign.css
public/figma/
public/theme-assets/
public/og-night.webp
\`\`\`

在目标项目的全局 Layout 中引入：

\`\`\`tsx
import "../styles/campaign.css";
\`\`\`

在需要展示活动的页面中使用：

\`\`\`tsx
import { CampaignExperience } from "@/components/campaign/CampaignExperience";

export default function CampaignPage() {
  return <CampaignExperience />;
}
\`\`\`

如果要放在 \`/campaign\` 路由，可将上面页面保存为 \`app/campaign/page.tsx\`。

## 默认行为

- 页面默认使用“夏天马上顺”主题。
- 抽卡进度保存在目标站点自己的 localStorage 中。
- 配置器本地 IndexedDB 中临时上传、但尚未写入源码或公共素材目录的文件不会自动跨域迁移。
- 当前工程内置的 Hero 首尾帧、道具卡、内容卡和品牌素材已经包含在 \`public/\` 中。
`,
);

console.log(`H5 preview exported to ${outputRoot}`);
