import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the unified summer campaign template", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>暑期好运季｜夏天马上顺<\/title>/i);
  assert.match(
    html,
    /class="campaign-shell campaign-template theme-summer"/,
  );
  assert.match(html, /class="[^"]*\bcampaign-stage\b[^"]*"/);
  assert.match(
    html,
    /class="[^"]*\bcampaign-hero\b[^"]*\bcampaign-hero-mask\b[^"]*"/,
  );
  assert.match(html, /class="[^"]*\bcampaign-action-bar\b[^"]*"/);
  assert.match(
    html,
    /class="collection-panel campaign-reward-shelf"/,
  );
  for (const layerClass of [
    "campaign-hero-stack",
    "campaign-map-layer",
    "campaign-hero-mask",
    "campaign-hero-media-layer",
    "campaign-hero-transition-layer",
    "campaign-hero-effect-layer",
    "campaign-hero-ui-layer",
  ]) {
    assert.match(
      html,
      new RegExp(`class="[^"]*\\b${layerClass}\\b[^"]*"`),
    );
  }
  assert.match(
    html,
    /src="\/theme-assets\/summer\/hero-scene-v2\.png"/,
  );
  assert.match(
    html,
    /class="[^"]*\bcampaign-hero-media-layer\b[^"]*"[\s\S]*?<img\b[^>]*src="\/theme-assets\/summer\/hero-scene-v2\.png"/,
  );
  assert.match(
    html,
    /\bcampaign-hero-media-layer\b[\s\S]*\bcampaign-hero-transition-layer\b[\s\S]*\bcampaign-hero-effect-layer\b[\s\S]*\bcampaign-hero-ui-layer\b/,
  );
  assert.match(html, /class="stage-nav campaign-theme-tabs"/);
  assert.doesNotMatch(html, /hero-measurement-overlay/);
  assert.match(html, /data-testid="theme-tab-summer"/);
  assert.match(html, /data-testid="theme-tab-night"/);
  assert.match(html, /夏日夜食指南/);
  assert.match(html, /data-testid="draw-button"/);
  assert.match(html, /data-testid="draw-balance"/);
  assert.match(html, /抽装备 一顺到底/);
  assert.match(html, /class="featured-task-rail"/);
  assert.equal(
    (
      html.match(
        /class="[^"]*\bcampaign-banner-slot\b[^"]*"/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(html, />攒体力<\/button>/);
  assert.doesNotMatch(html, /攒体力\s*·\s*预告/);
  assert.doesNotMatch(html, /\bcollection-count\b/);
  assert.doesNotMatch(html, /\bprogress-track\b/);
  assert.match(html, /扎进水里夏天（马上顺）/);
  assert.match(html, /抖音生活服务，让每次心动都值得/);
  assert.doesNotMatch(html, /figma\.com\/api\/mcp\/asset/i);
});

test("server-renders the campaign studio with starter drafts and a live campaign preview", async () => {
  const response = await render("/studio");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /data-testid="config-tool"/);
  assert.match(html, /class="studio-sidebar studio-library"/);
  assert.match(html, /class="studio-canvas"/);
  assert.match(html, /class="studio-sidebar studio-inspector"/);
  assert.match(html, /活动换肤配置器/);
  assert.match(html, /夏天马上顺 · 默认/);
  assert.match(html, /夏日夜食 · 默认/);

  for (const testId of [
    "config-preview",
    "config-import-input",
    "config-export",
    "config-field-title",
    "config-field-hero-media",
    "config-card-preview-watergun",
    "config-grand-reward-preview",
    "config-card-size-hint",
    "config-reward-size-hint",
    "inspector-group-global",
    "inspector-group-modules",
    "studio-canvas-surface",
    "studio-phone-stage",
    "studio-canvas-zoom-out",
    "studio-canvas-zoom",
    "studio-canvas-zoom-in",
    "studio-canvas-fit",
  ]) {
    assert.match(html, new RegExp(`data-testid="${testId}"`));
  }
  assert.match(
    html,
    /data-testid="config-preview"[^>]*data-preview-ratio="9:21"/,
  );
  assert.match(html, /画布 375 × 875 px · 9:21/);
  assert.match(
    html,
    /data-testid="config-card-preview-watergun"[^>]*src="\/figma\/equipment-water-gun\.webp"|src="\/figma\/equipment-water-gun\.webp"[^>]*data-testid="config-card-preview-watergun"/,
  );
  assert.match(
    html,
    /data-testid="config-grand-reward-preview"[^>]*src="\/figma\/reward-gold-horse\.webp"|src="\/figma\/reward-gold-horse\.webp"[^>]*data-testid="config-grand-reward-preview"/,
  );
  const textHtml = html.replaceAll("<!-- -->", "");
  assert.match(textHtml, /页面展示容器：59 × 72 px/);
  assert.match(textHtml, /页面展示容器：46 × 27 px/);
  assert.match(textHtml, /当前为模板实时样式/);
  assert.match(textHtml, /当前文件：180 × 156 px/);
  const globalGroupIndex = html.indexOf(
    'data-testid="inspector-group-global"',
  );
  const moduleGroupIndex = html.indexOf(
    'data-testid="inspector-group-modules"',
  );
  assert.ok(globalGroupIndex >= 0);
  assert.ok(moduleGroupIndex > globalGroupIndex);
  for (const moduleId of [
    "hero",
    "collection",
    "side-game",
    "tasks",
    "topics",
    "discovery",
    "activities",
  ]) {
    assert.match(html, new RegExp(`data-module-id="${moduleId}"`));
  }
  assert.match(html, /按住空格拖动画布/);
  assert.match(html, /在手机内滚动浏览 H5/);

  assert.match(html, /复制当前方案/);
  assert.match(html, /导入 JSON/);
  assert.match(html, /导出当前方案/);
  assert.match(html, /应用到活动页/);
  assert.doesNotMatch(html, /data-testid="config-error"/);

  assert.match(
    html,
    /class="campaign-shell campaign-template theme-summer"/,
  );
  assert.match(html, /data-testid="campaign-stage"/);
  assert.match(html, /data-testid="draw-button"/);
  assert.match(html, /data-testid="draw-balance"/);
  assert.match(html, /class="featured-task-rail"/);
});

test("keeps the Studio import, export, preview, and applied-skin contracts wired", async () => {
  const [page, studio, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    page,
    /export const ACTIVE_SKIN_STORAGE_KEY\s*=\s*["']campaign-active-skin-v1["']/,
  );
  assert.match(page, /export type CampaignSkinDraft\s*=/);
  assert.match(page, /export function createConfigurationFromSkin\s*\(/);
  assert.match(page, /export function CampaignExperience\s*\(/);
  assert.match(
    page,
    /localStorage\.getItem\(\s*ACTIVE_SKIN_STORAGE_KEY\s*,?\s*\)/,
  );
  assert.match(page, /isCampaignSkinDraft\(parsedSkin\)/);
  assert.match(page, /createConfigurationFromSkin\(parsedSkin\)/);
  assert.match(page, /export default function Home\s*\(\)/);
  assert.match(page, /return <CampaignExperience \/>/);

  assert.match(
    studio,
    /const DRAFTS_STORAGE_KEY\s*=\s*["']campaign-studio-drafts-v1["']/,
  );
  assert.match(studio, /id:\s*["']starter-summer["']/);
  assert.match(studio, /name:\s*["']夏天马上顺 · 默认["']/);
  assert.match(studio, /id:\s*["']starter-night["']/);
  assert.match(studio, /name:\s*["']夏日夜食 · 默认["']/);
  assert.match(studio, /function duplicateActive\s*\(/);
  assert.match(studio, /function resetActive\s*\(/);
  assert.match(studio, /function importDraft\s*\(/);
  assert.match(studio, /function exportActive\s*\(/);
  assert.match(studio, /function uploadTier\s*\(/);
  assert.match(studio, /new FileReader\(\)/);
  assert.match(studio, /new Blob\(/);
  assert.match(
    studio,
    /localStorage\.setItem\(\s*ACTIVE_SKIN_STORAGE_KEY\s*,/,
  );
  assert.match(
    studio,
    /<CampaignExperience[\s\S]*?configuration=\{runtimeConfiguration\}[\s\S]*?initialTheme=\{activeDraft\.baseTheme\}[\s\S]*?persistProgress=\{false\}[\s\S]*?fixture/,
  );

  for (const testId of [
    "config-tool",
    "config-preview",
    "config-import-input",
    "config-export",
    "config-error",
    "config-field-title",
    "config-field-hero-media",
    "inspector-group-global",
    "inspector-group-modules",
    "studio-canvas-surface",
    "studio-phone-stage",
    "studio-canvas-zoom-out",
    "studio-canvas-zoom",
    "studio-canvas-zoom-in",
    "studio-canvas-fit",
  ]) {
    assert.match(
      studio,
      new RegExp(`data-testid=["']${testId}["']`),
    );
  }
  for (const dynamicTestId of [
    "config-card-preview-watergun",
    "config-grand-reward-preview",
    "config-card-size-hint",
    "config-reward-size-hint",
  ]) {
    assert.match(studio, new RegExp(`["']${dynamicTestId}["']`));
  }
  assert.match(
    studio,
    /data-preview-ratio=["']9:21["']/,
  );
  assert.match(
    css,
    /\.studio-phone\s*\{(?=[^}]*box-sizing:\s*content-box)(?=[^}]*width:\s*375px)(?=[^}]*aspect-ratio:\s*9\s*\/\s*21)[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.studio-inspector\s*>\s*details\s*>\s*summary::after\s*\{[^}]*content:\s*["']\+["'][^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.studio-inspector\s*>\s*details\[open\]\s*>\s*summary::after\s*\{[^}]*content:\s*["'](?:−|-)["'][^}]*\}/s,
  );
  assert.match(studio, /studio-details-collapsed["']>展开/);
  assert.match(studio, /studio-details-expanded["']>收起/);
  for (const moduleId of [
    "hero",
    "collection",
    "side-game",
    "tasks",
    "topics",
    "discovery",
    "activities",
  ]) {
    assert.match(studio, new RegExp(`data-module-id=["']${moduleId}["']`));
  }
  assert.match(studio, /onWheel=\{handleCanvasWheel\}/);
  assert.match(studio, /onPointerDown=\{handleCanvasPointerDown\}/);
  assert.match(studio, /onPointerMove=\{handleCanvasPointerMove\}/);
  assert.match(studio, /onPointerUp=\{handleCanvasPointerEnd\}/);
  assert.match(studio, /onPointerCancel=\{handleCanvasPointerEnd\}/);
  assert.match(studio, /setPointerCapture\(/);
  assert.match(studio, /event\.code\s*!==\s*["']Space["']/);
  assert.match(studio, /isTypingTarget\(event\.target\)/);
  assert.match(studio, /!event\.ctrlKey\s*&&\s*!event\.metaKey/);
  assert.match(
    css,
    /\.studio-shell\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*inset:\s*0)(?=[^}]*overflow:\s*hidden)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.studio-canvas\s*\{(?=[^}]*height:\s*100%)(?=[^}]*min-height:\s*0)(?=[^}]*overflow:\s*hidden)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.studio-preview-world\s*\{(?=[^}]*overflow:\s*hidden)[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.studio-preview-world\s*\{[^}]*overflow:\s*(?:auto|scroll)[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.studio-sidebar\s*\{[^}]*overflow:\s*(?:auto|scroll)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.studio-inspector\s*\{(?=[^}]*height:\s*100%)(?=[^}]*min-height:\s*0)(?=[^}]*overflow-y:\s*auto)(?=[^}]*overflow-x:\s*hidden)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.studio-phone\s*\{(?=[^}]*overflow-y:\s*auto)(?=[^}]*overflow-x:\s*hidden)(?=[^}]*scrollbar-width:\s*none)[^}]*\}/s,
  );
});

test("keeps the campaign mechanics and local Figma assets wired", async () => {
  const [page, campaignStage, themePacks, themePackGuide, css] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/campaign-stage.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/campaign-theme-packs.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../THEME-PACKS.md", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(page, /summer-campaign-multitheme-v2/);
  assert.match(page, /fixtureModeRef/);
  assert.match(page, /createFigmaFixtureState/);
  assert.match(page, /function pickWeightedCard/);
  assert.match(page, /function renderTaskCard/);
  assert.match(page, /taskTab\s*===\s*["']energy["']/);
  assert.match(page, /\$\{task\.reward\}点体力/);
  assert.doesNotMatch(page, /\bcoming-card\b|\bcoming-visual\b/);
  assert.doesNotMatch(page, /接金豆副玩法正在准备/);
  assert.doesNotMatch(page, /\{theme\.energyTabLabel\}\s*·\s*预告/);
  assert.match(page, /handleDraw/);
  assert.match(page, /claimTier/);
  assert.match(page, /completeTask/);
  assert.match(page, /getThemePackStyle/);
  assert.match(page, /<CampaignStage/);
  assert.match(
    page,
    /searchParams\.get\(["']inspectHero["']\)\s*===\s*["']1["']/,
  );
  assert.match(
    page,
    /showHeroMeasurements=\{showHeroMeasurements\}/,
  );
  assert.match(page, /\bactivityBanners\.map\(/);

  const postHeroStart = page.indexOf("<CampaignStage");
  const postHeroEnd = page.indexOf("{drawResult &&", postHeroStart);
  assert.notEqual(postHeroStart, -1, "missing CampaignStage");
  assert.ok(postHeroEnd > postHeroStart, "missing post-hero source boundary");

  const postHeroSource = page.slice(postHeroStart, postHeroEnd);
  let postHeroCursor = -1;
  for (const moduleClass of [
    "energy-teaser",
    "tasks-section",
    "campaign-content-world",
    "topics-section",
    "discovery-section",
    "more-activities",
    "campaign-footer",
  ]) {
    const moduleIndex = postHeroSource.indexOf(moduleClass);
    assert.ok(
      moduleIndex > postHeroCursor,
      `${moduleClass} missing or out of order after CampaignStage`,
    );
    postHeroCursor = moduleIndex;
  }
  assert.doesNotMatch(
    postHeroSource,
    /theme\.id\s*===\s*["']summer["']/,
  );

  assert.match(themePacks, /export type CampaignThemePack/);
  assert.match(themePacks, /export const THEME_PACKS/);
  assert.match(themePacks, /export function getThemePackStyle/);
  assert.match(themePacks, /export type CampaignHeroMedia\s*=/);
  assert.match(themePacks, /heroMedia:\s*CampaignHeroMedia/);
  assert.match(themePacks, /\bheroMedia\b/);
  assert.match(themePacks, /type:\s*["']image["']/);
  assert.match(themePacks, /type:\s*["']video["']/);
  assert.match(
    themePacks,
    /src:\s*["']\/theme-assets\/summer\/hero-scene-v2\.png["'][\s\S]*?fit:\s*["']cover["'][\s\S]*?position:\s*["']center top["'][\s\S]*?sourceWidth:\s*375[\s\S]*?sourceHeight:\s*474/,
  );
  assert.match(
    themePacks,
    /src:\s*["']\/theme-assets\/night\/hero-scene\.webp["'][\s\S]*?fit:\s*["']contain["'][\s\S]*?position:\s*["']center top["'][\s\S]*?sourceWidth:\s*1125[\s\S]*?sourceHeight:\s*1125/,
  );
  assert.doesNotMatch(themePacks, /\bheroImage\b/);
  assert.match(
    themePacks,
    /(?:media layer[^.\n]*375\s*[:×x]\s*460|375\s*[:×x]\s*460[^.\n]*media layer)/i,
  );
  assert.doesNotMatch(themePacks, /375\s*[:×x]\s*375/i);
  assert.match(
    themePackGuide,
    /Hero 媒体槽[^。\n]*375\s*[×x:]\s*460/i,
  );
  assert.match(campaignStage, /export function CampaignStage/);
  assert.match(campaignStage, /className="campaign-stage"/);
  assert.match(campaignStage, /campaign-hero-stack/);
  assert.match(campaignStage, /campaign-map-layer/);
  assert.match(campaignStage, /campaign-hero-mask/);
  assert.match(campaignStage, /campaign-hero-media-layer/);
  assert.match(campaignStage, /campaign-hero-transition-layer/);
  assert.match(campaignStage, /campaign-hero-effect-layer/);
  assert.match(campaignStage, /campaign-hero-ui-layer/);
  assert.match(
    campaignStage,
    /campaign-hero-media-layer[\s\S]*campaign-hero-transition-layer[\s\S]*campaign-hero-effect-layer[\s\S]*campaign-hero-ui-layer/,
  );
  assert.match(campaignStage, /<video\b/);
  assert.match(campaignStage, /\bmuted\b/);
  assert.match(campaignStage, /\bloop\b/);
  assert.match(campaignStage, /\bplaysInline\b/);
  assert.match(campaignStage, /data-testid=\{`theme-tab-\$\{tab\.id\}`\}/);
  assert.match(campaignStage, /data-testid="draw-balance"/);
  assert.match(
    campaignStage,
    /data-testid="hero-measurement-overlay"/,
  );
  assert.match(campaignStage, /data-hero-ratio="375\/460"/);
  assert.match(campaignStage, /data-transition-inset="65\.2174%"/);
  assert.match(campaignStage, /data-reward-overlap="27px"/);
  assert.doesNotMatch(campaignStage, /\bcollectionEyebrow\b/);
  assert.match(campaignStage, /collectionHeadingMatch/);
  assert.match(campaignStage, /<em>\{collectionHeadingMatch\[2\]\}<\/em>/);
  assert.doesNotMatch(campaignStage, /className="collection-count"/);
  assert.doesNotMatch(campaignStage, /className="progress-track"/);
  assert.match(css, /Figma A1: 375px image-first summer campaign/);
  assert.match(
    css,
    /\.campaign-shell\s*\{[^}]*width:\s*100%[^}]*max-width:\s*520px/s,
  );
  assert.match(
    css,
    /\.campaign-shell\.campaign-template\s*\{[^}]*overflow:\s*clip\b[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.campaign-shell\.theme-summer\s*\{[^}]*\bwidth:/s,
  );
  assert.match(css, /background:\s*url\("\/figma\/svg-07\.svg"\)/);
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-map-layer\s*\{(?=[^}]*position:\s*sticky)(?=[^}]*top:\s*0(?:px)?\b)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero\s*\{(?=[^}]*aspect-ratio:\s*375\s*\/\s*460)(?=[^}]*overflow:\s*hidden)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero-transition-layer\s*\{(?=[^}]*inset:\s*65\.2174%\s+0\s+0)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero-measurement-overlay\s*\{(?=[^}]*position:\s*absolute)(?=[^}]*inset:\s*0)(?=[^}]*pointer-events:\s*none)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero-mask\s*\{(?=[^}]*overflow:\s*hidden)(?=[^}]*border-radius:\s*var\(--campaign-hero-radius\)\s+var\(--campaign-hero-radius\)\s+0(?:px)?\s+0(?:px)?\b)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero-media\s*\{(?=[^}]*width:\s*100%)(?=[^}]*height:\s*100%)[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.campaign-template\s+\.campaign-hero-media\s*\{[^}]*height:\s*88\.2353%[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template[^{]*\.campaign-action-bar\s*\{(?=[^}]*top:\s*81\.5217%)(?=[^}]*height:\s*10\.8696%)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero\s+\.campaign-theme-tabs,[\s\S]*?\{[^}]*top:\s*28\.0435%/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero\s+\.campaign-theme-tabs,[\s\S]*?\{(?=[^}]*backdrop-filter:\s*blur\(6px\))(?=[^}]*box-shadow:\s*0\s+2px\s+6px)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-action-bar\s+\.draw-button\s*\{(?=[^}]*padding:\s*0\s+8%)(?=[^}]*border:\s*2px\s+solid\s+color-mix)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-reward-shelf\s*\{(?=[^}]*aspect-ratio:\s*355\s*\/\s*166)(?=[^}]*margin:\s*clamp\(-36px,\s*-7\.2cqw,\s*-27px\)\s+10px\s+0)[^}]*\}/s,
  );
  assert.doesNotMatch(
    css,
    /\.campaign-template\s+\.campaign-reward-shelf::(?:before|after)\b/,
  );
  assert.match(
    css,
    /\.featured-task-rail\s*\{(?=[^}]*padding:\s*0\s+16px\s+5px)(?=[^}]*scroll-padding-inline:\s*16px)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.theme-summer\s+\.topic-chips\s*\{(?=[^}]*height:\s*74px)(?=[^}]*padding:\s*1px\s+16px\s+5px)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.theme-summer\s+\.inspiration-grid\s*\{(?=[^}]*padding:\s*0\s+16px\s+6px)(?=[^}]*scroll-padding-inline:\s*16px)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.tier:nth-child\(-n\s*\+\s*3\)[\s\S]*?\.tier-ticket\s*\{(?=[^}]*transform:\s*scale\(0\.82\))[^}]*\}/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-reward-shelf\s+\.card-scroller\s*\{[^}]*bottom:\s*7\.8%/s,
  );
  for (const sharedModuleSelector of [
    "\\.energy-teaser",
    "\\.tasks-section",
    "\\.topics-section",
    "\\.discovery-section",
    "footer\\.campaign-footer",
  ]) {
    assert.match(
      css,
      new RegExp(
        `\\.campaign-template\\s+${sharedModuleSelector}\\s*\\{`,
      ),
    );
  }
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-banner-list\s*\{(?=[^}]*display:\s*grid)(?=[^}]*gap:\s*10px)[^}]*\}/s,
  );
  assert.doesNotMatch(css, /\.coming-card\b|\.coming-visual\b/);
  assert.doesNotMatch(css, /\.collection-count\b/);
  assert.doesNotMatch(css, /\.progress-track\b/);

  assert.doesNotMatch(page, /\bheroMode\b/);
  assert.doesNotMatch(page, /\bheroImage\b/);
  assert.doesNotMatch(page, /uniqueCount\s*===\s*9/);
  assert.doesNotMatch(
    page,
    /coupon\.tierId\s*===\s*["']tier-9["']/,
  );
  assert.doesNotMatch(page, /随机获得9种卡/);

  await Promise.all(
    [
      "../public/figma/crops/map-cap.png",
      "../public/theme-assets/summer/hero-scene-v2.png",
      "../public/figma/crops/brand-logo.png",
      "../public/figma/equipment-water-gun.webp",
      "../public/figma/equipment-watermelon-bucket.webp",
      "../public/figma/equipment-paddle-board.webp",
      "../public/figma/equipment-palm-tree.webp",
      "../public/figma/equipment-pineapple-float.webp",
      "../public/figma/equipment-sun-chair.webp",
      "../public/figma/reward-gold-horse.webp",
      "../public/figma/topic-sunset-card.webp",
      "../public/figma/content-card-lions.webp",
      "../public/theme-assets/night/hero-scene.webp",
    ].map((asset) => access(new URL(asset, import.meta.url))),
  );
});
