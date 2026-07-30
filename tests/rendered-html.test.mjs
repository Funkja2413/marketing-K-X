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
  assert.match(html, /data-testid="theme-tab-summer"/);
  assert.match(html, /data-testid="theme-tab-night"/);
  assert.match(html, /夏日夜食指南/);
  assert.match(html, /data-testid="draw-button"/);
  assert.match(html, /data-testid="draw-balance"/);
  assert.match(html, /class="featured-task-rail"/);
  assert.doesNotMatch(html, /\bcollection-count\b/);
  assert.doesNotMatch(html, /\bprogress-track\b/);
  assert.match(html, /扎进水里夏天（马上顺）/);
  assert.match(html, /抖音生活服务，让每次心动都值得/);
  assert.doesNotMatch(html, /figma\.com\/api\/mcp\/asset/i);
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
  assert.match(page, /handleDraw/);
  assert.match(page, /claimTier/);
  assert.match(page, /completeTask/);
  assert.match(page, /getThemePackStyle/);
  assert.match(page, /<CampaignStage/);
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
    /src:\s*["']\/theme-assets\/summer\/hero-scene-v2\.png["'][\s\S]*?fit:\s*["']cover["'][\s\S]*?position:\s*["']center top["']/,
  );
  assert.doesNotMatch(themePacks, /\bheroImage\b/);
  assert.match(
    themePacks,
    /(?:media layer[^.\n]*375\s*[:×x]\s*425|375\s*[:×x]\s*425[^.\n]*media layer)/i,
  );
  assert.doesNotMatch(themePacks, /375\s*[:×x]\s*375/i);
  assert.match(
    themePackGuide,
    /Hero 媒体槽[^。\n]*375\s*[×x:]\s*425/i,
  );
  assert.doesNotMatch(
    themePackGuide,
    /Hero 媒体槽[^。\n]*375\s*[×x:]\s*375/i,
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
    /\.campaign-template\s+\.campaign-hero\s*\{(?=[^}]*aspect-ratio:\s*375\s*\/\s*425)(?=[^}]*overflow:\s*hidden)[^}]*\}/s,
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
    /\.campaign-template[^{]*\.campaign-action-bar\s*\{[^}]*height:\s*11\.7647%/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-hero\s+\.campaign-theme-tabs,[\s\S]*?\{[^}]*top:\s*30\.35%/s,
  );
  assert.match(
    css,
    /\.campaign-template\s+\.campaign-reward-shelf\s*\{(?=[^}]*aspect-ratio:\s*355\s*\/\s*166)(?=[^}]*margin:\s*clamp\(8px,\s*2\.133cqw,\s*11px\)\s+10px\s+0)[^}]*\}/s,
  );
  assert.match(
    css,
    /\.featured-task-rail\s*\{(?=[^}]*padding:\s*0\s+16px\s+5px)(?=[^}]*scroll-padding-inline:\s*16px)[^}]*\}/s,
  );
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
      "../public/figma/topic-sunset-card.webp",
      "../public/figma/content-card-lions.webp",
      "../public/theme-assets/night/hero-scene.webp",
    ].map((asset) => access(new URL(asset, import.meta.url))),
  );
});
