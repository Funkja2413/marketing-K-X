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

test("server-renders the Figma-based summer campaign shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>暑期好运季｜夏天马上顺<\/title>/i);
  assert.match(html, /class="campaign-shell theme-summer"/);
  assert.match(html, /class="summer-map-cap"/);
  assert.match(html, /src="\/figma\/crops\/hero-scene\.webp"/);
  assert.match(html, /data-testid="draw-button"/);
  assert.match(html, /class="collection-panel"/);
  assert.match(html, /class="featured-task-rail"/);
  assert.match(html, /扎进水里夏天（马上顺）/);
  assert.match(html, /抖音生活服务，让每次心动都值得/);
  assert.doesNotMatch(html, /figma\.com\/api\/mcp\/asset/i);
});

test("keeps the campaign mechanics and local Figma assets wired", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.match(css, /Figma A1: 375px image-first summer campaign/);
  assert.match(css, /background:\s*url\("\/figma\/svg-07\.svg"\)/);

  await Promise.all(
    [
      "../public/figma/crops/map-cap.png",
      "../public/figma/crops/hero-scene.webp",
      "../public/figma/crops/brand-logo.png",
      "../public/figma/equipment-water-gun.webp",
      "../public/figma/topic-sunset-card.webp",
      "../public/figma/content-card-lions.webp",
    ].map((asset) => access(new URL(asset, import.meta.url))),
  );
});
