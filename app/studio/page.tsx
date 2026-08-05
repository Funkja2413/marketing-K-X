"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACTIVE_SKIN_STORAGE_KEY,
  CampaignExperience,
  THEMES,
  createConfigurationFromSkin,
  type CampaignSkinDraft,
  type CardDefinition,
  type ThemeDefinition,
  type TierDefinition,
} from "../page";
import {
  THEME_PACKS,
  type CampaignCollectionHeroComposition,
  type CampaignCollectionHeroLayer,
  type CampaignHeroMedia,
  type CampaignThemePack,
  type ThemeId,
} from "../campaign-theme-packs";

const DRAFTS_STORAGE_KEY = "campaign-studio-drafts-v1";
const DEFAULT_UPDATED_AT = "2026-07-31T00:00:00.000Z";
const CANVAS_MIN_ZOOM = 0.4;
const CANVAS_MAX_ZOOM = 1.25;
const DEFAULT_HERO_AI_PROMPT =
  "生成一张更有冲浪速度感的夏日首焦，保留当前 IP 和标题";
const DEFAULT_COLLECTION_AI_PROMPT =
  "生成一整套夏日冲浪主题的道具卡与奖励，透明底、统一果冻质感";
const STUDIO_ASSET_DB_NAME = "campaign-studio-assets-v1";
const STUDIO_ASSET_STORE = "assets";
const STUDIO_ASSET_REF_PREFIX = "idb://";

type StudioCachedAsset = {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
};

let studioAssetDbPromise: Promise<IDBDatabase> | null = null;

function openStudioAssetDb() {
  if (studioAssetDbPromise) return studioAssetDbPromise;
  studioAssetDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(STUDIO_ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STUDIO_ASSET_STORE)) {
        database.createObjectStore(STUDIO_ASSET_STORE, {
          keyPath: "id",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return studioAssetDbPromise;
}

function waitForIdbRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForIdbTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function putStudioCachedAsset(id: string, blob: Blob) {
  const database = await openStudioAssetDb();
  const transaction = database.transaction(
    STUDIO_ASSET_STORE,
    "readwrite",
  );
  transaction.objectStore(STUDIO_ASSET_STORE).put({
    id,
    blob,
    mimeType: blob.type || "application/octet-stream",
    updatedAt: new Date().toISOString(),
  } satisfies StudioCachedAsset);
  await waitForIdbTransaction(transaction);
}

async function getStudioCachedAsset(id: string) {
  const database = await openStudioAssetDb();
  const transaction = database.transaction(STUDIO_ASSET_STORE, "readonly");
  return waitForIdbRequest(
    transaction
      .objectStore(STUDIO_ASSET_STORE)
      .get(id) as IDBRequest<StudioCachedAsset | undefined>,
  );
}

function getStudioAssetIdFromRef(src?: string) {
  return src?.startsWith(STUDIO_ASSET_REF_PREFIX)
    ? src.slice(STUDIO_ASSET_REF_PREFIX.length)
    : undefined;
}

function getStudioAssetRef(assetId: string) {
  return `${STUDIO_ASSET_REF_PREFIX}${assetId}`;
}

function createStudioAssetId(
  draftId: string,
  slot:
    | "hero"
    | "hero-end"
    | "card"
    | "hero-layer"
    | "transition"
    | "transition-poster",
  entityId: string,
) {
  return `${draftId}:${slot}:${entityId}`;
}

async function cacheStudioSource(assetId: string, src: string) {
  const cached = await getStudioCachedAsset(assetId);
  if (cached) return URL.createObjectURL(cached.blob);
  if (!src || src.startsWith(STUDIO_ASSET_REF_PREFIX)) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("素材读取失败");
  const blob = await response.blob();
  await putStudioCachedAsset(assetId, blob);
  return URL.createObjectURL(blob);
}

async function cacheStudioFile(assetId: string, file: File) {
  await putStudioCachedAsset(assetId, file);
  return URL.createObjectURL(file);
}

type AiStatus = "idle" | "generating" | "ready";
type StudioCanvasMode = "page" | "flow";

type AiBatchSlot = {
  kind: "card" | "reward";
  slotId: string;
  entityId: string;
  label: string;
  displaySize: string;
  outputSize: string;
  accepts: string;
};

type AiTarget = {
  draftId: string;
  pageId: string;
  kind: "hero" | "card" | "reward" | "collection-kit";
  moduleId: "M1" | "M2";
  slotId: string;
  entityId?: string;
  label: string;
  displaySize: string;
  outputSize: string;
  accepts: string;
  batchSlots?: AiBatchSlot[];
};

type AiCandidate = {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  position?: string;
  target: AiTarget | null;
};

type AiReference = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

type M2BatchCandidate = {
  id: string;
  kind: "m2-batch";
  draftId: string;
  pageId: string;
  cardCount: number;
  rewardCount: 4;
  assets: AiCandidate[];
};

type AiCandidateGroup = {
  id: string;
  draftId: string;
  pageId: string;
  prompt: string;
  target: AiTarget | null;
  references: AiReference[];
  candidates: AiCandidate[];
  batch?: M2BatchCandidate;
  position: { x: number; y: number };
  collapsed: boolean;
};

type SelectedAiAsset = {
  groupId: string;
  candidateId: string;
};

type AiTrial = {
  groupId: string;
  target: AiTarget;
  candidate: AiCandidate;
};

type AiCommitHistory = {
  draftId: string;
  before: CampaignSkinDraft;
};

type CampaignPageNode = {
  id: string;
  order: string;
  name: string;
  route: string;
  kind: "screen" | "overlay";
  template: "loading" | "character-select" | "campaign" | "standard";
  status: "ready" | "draft";
};

type CampaignFlowEdge = {
  id: string;
  fromPageId: string;
  eventKey: string;
  targetPageId: string;
  navigation: "push" | "replace" | "overlay" | "back";
  transition: "fade" | "slide" | "none";
};

const CAMPAIGN_PAGES: CampaignPageNode[] = [
  {
    id: "loading",
    order: "01",
    name: "开场 Loading",
    route: "#/loading",
    kind: "screen",
    template: "loading",
    status: "draft",
  },
  {
    id: "character-select",
    order: "02",
    name: "角色选择",
    route: "#/character",
    kind: "screen",
    template: "character-select",
    status: "draft",
  },
  {
    id: "campaign-main",
    order: "03",
    name: "活动主页",
    route: "#/campaign",
    kind: "screen",
    template: "campaign",
    status: "ready",
  },
  {
    id: "prizes",
    order: "04",
    name: "我的奖品",
    route: "#/prizes",
    kind: "screen",
    template: "standard",
    status: "draft",
  },
  {
    id: "rules",
    order: "05",
    name: "活动规则",
    route: "#/rules",
    kind: "overlay",
    template: "standard",
    status: "draft",
  },
];

const CAMPAIGN_FLOW_EDGES: CampaignFlowEdge[] = [
  {
    id: "loading-ready",
    fromPageId: "loading",
    eventKey: "assets.ready",
    targetPageId: "character-select",
    navigation: "replace",
    transition: "fade",
  },
  {
    id: "character-confirm",
    fromPageId: "character-select",
    eventKey: "confirm.click",
    targetPageId: "campaign-main",
    navigation: "replace",
    transition: "slide",
  },
  {
    id: "campaign-prizes",
    fromPageId: "campaign-main",
    eventKey: "prize.click",
    targetPageId: "prizes",
    navigation: "push",
    transition: "slide",
  },
  {
    id: "campaign-rules",
    fromPageId: "campaign-main",
    eventKey: "rules.click",
    targetPageId: "rules",
    navigation: "overlay",
    transition: "fade",
  },
];

type PackColorKey = keyof CampaignThemePack["colors"];
type PackAssetKey = Exclude<
  keyof CampaignThemePack["assets"],
  "heroMedia" | "collectionHeroComposition"
>;

const CORE_COLOR_FIELDS: Array<{
  key: PackColorKey;
  label: string;
}> = [
  { key: "page", label: "页面背景" },
  { key: "heroBackground", label: "Hero 兜底色" },
  { key: "surface", label: "内容卡片" },
  { key: "surfaceText", label: "主要文字" },
  { key: "accent", label: "品牌强调色" },
  { key: "actionStart", label: "主按钮起始色" },
  { key: "actionEnd", label: "主按钮结束色" },
];

const ADVANCED_COLOR_FIELDS: Array<{
  key: PackColorKey;
  label: string;
}> = [
  { key: "mapBackground", label: "地图背景" },
  { key: "mutedText", label: "辅助文字" },
  { key: "accentText", label: "强调色文字" },
  { key: "actionShadow", label: "按钮阴影" },
  { key: "sideAction", label: "两侧操作底色" },
  { key: "sideActionText", label: "两侧操作文字" },
  { key: "tabSurface", label: "Tab 轨道" },
  { key: "tabText", label: "Tab 文字" },
  { key: "tabActiveSurface", label: "选中 Tab" },
  { key: "tabActiveText", label: "选中 Tab 文字" },
  { key: "cardBorder", label: "卡片描边" },
  { key: "cardOwned", label: "已获得卡片" },
  { key: "cardMissing", label: "未获得卡片" },
  { key: "countBadge", label: "数字徽标" },
];

const KNOWN_ASSET_SIZES: Record<
  string,
  { width: number; height: number }
> = {
  "/figma/equipment-water-gun.webp": { width: 180, height: 156 },
  "/figma/equipment-watermelon-bucket.webp": {
    width: 180,
    height: 179,
  },
  "/figma/equipment-paddle-board.webp": { width: 93, height: 180 },
  "/figma/equipment-palm-tree.webp": { width: 159, height: 180 },
  "/figma/equipment-pineapple-float.webp": {
    width: 180,
    height: 138,
  },
  "/figma/equipment-sun-chair.webp": { width: 150, height: 180 },
  "/figma/reward-gold-horse.webp": { width: 132, height: 112 },
};

const CARD_BATCH_SOURCES = [
  "/figma/equipment-water-gun.webp",
  "/figma/equipment-watermelon-bucket.webp",
  "/figma/equipment-paddle-board.webp",
  "/figma/equipment-palm-tree.webp",
  "/figma/equipment-pineapple-float.webp",
  "/figma/equipment-sun-chair.webp",
  "/figma/equipment-water-gun.webp",
  "/figma/equipment-watermelon-bucket.webp",
  "/figma/equipment-paddle-board.webp",
] as const;

const REWARD_BATCH_SOURCES = [
  "/figma/equipment-pineapple-float.webp",
  "/figma/mascot-side-horse.webp",
  "/figma/equipment-watermelon-bucket.webp",
  "/figma/reward-gold-horse.webp",
] as const;

function createHeroAiTarget(draft: CampaignSkinDraft): AiTarget {
  return {
    draftId: draft.id,
    pageId: "campaign-main",
    kind: "hero",
    moduleId: "M1",
    slotId: "m1.hero-media",
    label: "M1 · Hero 首焦",
    displaySize: "375 × 500 px",
    outputSize: "1125 × 1500 px",
    accepts: "图片 / 视频 · Cover · UI 安全区",
  };
}

function createCollectionKitAiTarget(
  draft: CampaignSkinDraft,
): AiTarget {
  const cardSlots: AiBatchSlot[] = draft.content.cards.flatMap((card) => {
    const target = createCardAiTarget(draft, card.id);
    return target
      ? [
          {
            kind: "card",
            slotId: target.slotId,
            entityId: card.id,
            label: card.name,
            displaySize: target.displaySize,
            outputSize: target.outputSize,
            accepts: target.accepts,
          } satisfies AiBatchSlot,
        ]
      : [];
  });
  const rewardSlots: AiBatchSlot[] = draft.content.tiers.flatMap(
    (tier) => {
      const target = createRewardAiTarget(draft, tier.id);
      return target
        ? [
            {
              kind: "reward",
              slotId: target.slotId,
              entityId: tier.id,
              label: tier.title,
              displaySize: target.displaySize,
              outputSize: target.outputSize,
              accepts: target.accepts,
            } satisfies AiBatchSlot,
          ]
        : [];
    },
  );
  return {
    draftId: draft.id,
    pageId: "campaign-main",
    kind: "collection-kit",
    moduleId: "M2",
    slotId: "m2.collection-reward-kit",
    label: "M2 · 集卡与奖励整套",
    displaySize: `${cardSlots.length} 个卡槽 + ${rewardSlots.length} 个奖励槽`,
    outputSize: `${cardSlots.length} × 180×220 + ${rewardSlots.length} 档奖励规格`,
    accepts: `${cardSlots.length + rewardSlots.length} 张透明图片 · 同一套风格 · 稳定 ID 映射`,
    batchSlots: [...cardSlots, ...rewardSlots],
  };
}

function createCardAiTarget(
  draft: CampaignSkinDraft,
  cardId = draft.content.cards[0]?.id,
): AiTarget | null {
  const card = draft.content.cards.find((item) => item.id === cardId);
  if (!card) return null;
  return {
    draftId: draft.id,
    pageId: "campaign-main",
    kind: "card",
    moduleId: "M2",
    slotId: `m2.card.${card.id}`,
    entityId: card.id,
    label: `M2 · ${card.name}`,
    displaySize: "59 × 72 px",
    outputSize: "180 × 220 px",
    accepts: "透明 PNG / WebP · 8% 安全边",
  };
}

function createRewardAiTarget(
  draft: CampaignSkinDraft,
  tierId = draft.content.tiers.at(-1)?.id,
): AiTarget | null {
  const tier = draft.content.tiers.find((item) => item.id === tierId);
  if (!tier) return null;
  return {
    draftId: draft.id,
    pageId: "campaign-main",
    kind: "reward",
    moduleId: "M2",
    slotId: `m2.reward.${tier.id}`,
    entityId: tier.id,
    label: `M2 · ${tier.title}`,
    displaySize: tier.kind === "grand" ? "44 × 30 px" : "46 × 27 px",
    outputSize: tier.kind === "grand" ? "132 × 90 px" : "140 × 82 px",
    accepts: "透明 PNG / WebP · 主体居中",
  };
}

function createMockAiCandidates(
  draft: CampaignSkinDraft,
  target: AiTarget | null,
): AiCandidate[] {
  const targetSnapshot = target ? { ...target } : null;
  if (target?.kind === "collection-kit") {
    const slots = target.batchSlots ?? [];
    let cardIndex = 0;
    let rewardIndex = 0;
    return slots.map((slot, index) => {
      const isCard = slot.kind === "card";
      const source = isCard
        ? CARD_BATCH_SOURCES[cardIndex++ % CARD_BATCH_SOURCES.length]
        : REWARD_BATCH_SOURCES[
            rewardIndex++ % REWARD_BATCH_SOURCES.length
          ];
      const knownSize = KNOWN_ASSET_SIZES[source];
      const slotTarget: AiTarget = {
        draftId: target.draftId,
        pageId: target.pageId,
        kind: slot.kind,
        moduleId: "M2",
        slotId: slot.slotId,
        entityId: slot.entityId,
        label: `M2 · ${slot.label}`,
        displaySize: slot.displaySize,
        outputSize: slot.outputSize,
        accepts: slot.accepts,
      };
      return {
        id: `collection-kit-${slot.kind}-${slot.entityId}-${Date.now()}-${index}`,
        label: slot.label,
        src: source,
        width: knownSize?.width ?? (isCard ? 180 : 140),
        height: knownSize?.height ?? (isCard ? 220 : 82),
        target: slotTarget,
      };
    });
  }
  if (target?.kind === "card") {
    return [
      {
        id: `card-watergun-${Date.now()}`,
        label: "清透果冻质感",
        src: "/figma/equipment-water-gun.webp",
        width: 180,
        height: 156,
        target: targetSnapshot,
      },
      {
        id: `card-watermelon-${Date.now()}`,
        label: "夏日食物道具",
        src: "/figma/equipment-watermelon-bucket.webp",
        width: 180,
        height: 179,
        target: targetSnapshot,
      },
      {
        id: `card-board-${Date.now()}`,
        label: "运动装备方向",
        src: "/figma/equipment-paddle-board.webp",
        width: 93,
        height: 180,
        target: targetSnapshot,
      },
    ];
  }
  if (target?.kind === "reward") {
    return [
      {
        id: `reward-horse-${Date.now()}`,
        label: "金色大奖",
        src: "/figma/reward-gold-horse.webp",
        width: 132,
        height: 112,
        target: targetSnapshot,
      },
      {
        id: `reward-mascot-${Date.now()}`,
        label: "IP 公仔大奖",
        src: "/figma/mascot-side-horse.webp",
        width: 180,
        height: 180,
        target: targetSnapshot,
      },
      {
        id: `reward-float-${Date.now()}`,
        label: "夏日限定奖励",
        src: "/figma/equipment-pineapple-float.webp",
        width: 180,
        height: 138,
        target: targetSnapshot,
      },
    ];
  }

  const isNight = draft.baseTheme === "night";
  const currentHero = draft.pack.assets.heroMedia;
  return [
    {
      id: `hero-current-${Date.now()}`,
      label: "沿用当前构图",
      src: currentHero.src,
      width: currentHero.sourceWidth ?? 1125,
      height: currentHero.sourceHeight ?? 1500,
      position: currentHero.position ?? "center top",
      target: targetSnapshot,
    },
    {
      id: `hero-master-${Date.now()}`,
      label: isNight ? "夜色氛围加强" : "主体更突出",
      src: isNight
        ? "/theme-assets/night/hero-scene.webp"
        : "/hero-summer-base.webp",
      width: isNight ? 1125 : 1159,
      height: isNight ? 1125 : 1420,
      position: "center top",
      target: targetSnapshot,
    },
    {
      id: `hero-explore-${Date.now()}`,
      label: isNight ? "跨主题探索版" : "完整活动构图",
      src: isNight ? "/og-night.webp" : "/figma/crops/hero-scene.webp",
      width: 1125,
      height: 1125,
      position: "center top",
      target: targetSnapshot,
    },
  ];
}

function applyAiCandidateToDraft(
  draft: CampaignSkinDraft,
  target: AiTarget,
  candidate: AiCandidate,
): CampaignSkinDraft {
  const next = cloneValue(draft);
  if (target.kind === "hero") {
    next.pack.assets.heroMedia = {
      type: "image",
      src: candidate.src,
      fit: "cover",
      position: candidate.position ?? "center top",
      sourceWidth: candidate.width,
      sourceHeight: candidate.height,
    };
  }
  if (target.kind === "card" && target.entityId) {
    next.content.cards = next.content.cards.map((card) =>
      card.id === target.entityId
        ? {
            ...card,
            image: candidate.src,
            imageAssetId: undefined,
            imageWidth: candidate.width,
            imageHeight: candidate.height,
          }
        : card,
    );
    const composition = next.pack.assets.collectionHeroComposition;
    if (composition) {
      composition.layers = composition.layers.map((layer) =>
        layer.cardId === target.entityId && !layer.embeddedInBase
          ? {
              ...layer,
              presentation: "image-layer",
              media: {
                type: "image",
                src: candidate.src,
                fit: "contain",
                position: "center",
                sourceWidth: candidate.width,
                sourceHeight: candidate.height,
              },
            }
          : layer,
      );
    }
  }
  if (target.kind === "reward" && target.entityId) {
    const selectedTier = next.content.tiers.find(
      (tier) => tier.id === target.entityId,
    );
    next.content.tiers = next.content.tiers.map((tier) =>
      tier.id === target.entityId
        ? {
            ...tier,
            image: candidate.src,
            imageWidth: candidate.width,
            imageHeight: candidate.height,
          }
        : tier,
    );
    if (selectedTier?.kind === "grand") {
      next.pack.assets.grandRewardImage = candidate.src;
    }
  }
  return next;
}

function applyM2BatchToDraft(
  draft: CampaignSkinDraft,
  batch: M2BatchCandidate,
): CampaignSkinDraft {
  if (batch.draftId !== draft.id) {
    throw new Error("批次属于其他方案");
  }
  if (
    draft.content.cards.length !== batch.cardCount ||
    draft.content.tiers.length !== batch.rewardCount
  ) {
    throw new Error("当前模块结构已经变化");
  }
  const cardAssets = new Map<string, AiCandidate>();
  const rewardAssets = new Map<string, AiCandidate>();
  for (const candidate of batch.assets) {
    const target = candidate.target;
    if (!target?.entityId) continue;
    if (target.kind === "card") {
      if (cardAssets.has(target.entityId)) {
        throw new Error("卡片槽位重复");
      }
      cardAssets.set(target.entityId, candidate);
    }
    if (target.kind === "reward") {
      if (rewardAssets.has(target.entityId)) {
        throw new Error("奖励槽位重复");
      }
      rewardAssets.set(target.entityId, candidate);
    }
  }
  const expectedCardIds = new Set(
    draft.content.cards.map((card) => card.id),
  );
  const expectedRewardIds = new Set(
    draft.content.tiers.map((tier) => tier.id),
  );
  if (
    cardAssets.size !== expectedCardIds.size ||
    rewardAssets.size !== expectedRewardIds.size ||
    [...cardAssets.keys()].some((id) => !expectedCardIds.has(id)) ||
    [...rewardAssets.keys()].some((id) => !expectedRewardIds.has(id))
  ) {
    throw new Error(
      `批次没有完整覆盖当前 ${expectedCardIds.size} 张卡片与 ${expectedRewardIds.size} 档奖励`,
    );
  }

  const next = cloneValue(draft);
  next.content.cards = next.content.cards.map((card) => {
    const candidate = cardAssets.get(card.id);
    if (!candidate) return card;
    return {
      ...card,
      image: candidate.src,
      imageAssetId: undefined,
      imageWidth: candidate.width,
      imageHeight: candidate.height,
    };
  });
  const composition = next.pack.assets.collectionHeroComposition;
  if (composition) {
    composition.layers = composition.layers.map((layer) => {
      const candidate = cardAssets.get(layer.cardId);
      if (!candidate || layer.embeddedInBase) return layer;
      return {
        ...layer,
        presentation: "image-layer",
        media: {
          type: "image",
          src: candidate.src,
          fit: "contain",
          position: "center",
          sourceWidth: candidate.width,
          sourceHeight: candidate.height,
        },
      };
    });
  }
  next.content.tiers = next.content.tiers.map((tier) => {
    const candidate = rewardAssets.get(tier.id);
    if (!candidate) return tier;
    return {
      ...tier,
      image: candidate.src,
      imageWidth: candidate.width,
      imageHeight: candidate.height,
    };
  });
  const grandTier = next.content.tiers.find(
    (tier) => tier.kind === "grand",
  );
  if (grandTier?.image) {
    next.pack.assets.grandRewardImage = grandTier.image;
  }
  return next;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type HeroTransitionLibraryItem = {
  key: string;
  media: Extract<CampaignHeroMedia, { type: "video" }>;
  sourceLayerIds: string[];
  sourceLabels: string[];
};

function getHeroTransitionMediaKey(media?: CampaignHeroMedia) {
  if (!media?.src || media.type !== "video") return "";
  return media.assetId ?? media.src;
}

function createHeroTransitionLibrary(
  layers: CampaignCollectionHeroLayer[],
) {
  const library = new Map<string, HeroTransitionLibraryItem>();
  for (const layer of layers) {
    const media = layer.transitionMedia;
    const key = getHeroTransitionMediaKey(media);
    if (!key || media?.type !== "video") continue;
    const existing = library.get(key);
    if (existing) {
      existing.sourceLayerIds.push(layer.id);
      existing.sourceLabels.push(layer.label);
      continue;
    }
    library.set(key, {
      key,
      media,
      sourceLayerIds: [layer.id],
      sourceLabels: [layer.label],
    });
  }
  return Array.from(library.values());
}

async function hydrateAndCacheDraftAssets(
  sourceDrafts: CampaignSkinDraft[],
) {
  const drafts = cloneValue(sourceDrafts);
  for (const draft of drafts) {
    const heroMedia = draft.pack.assets.heroMedia;
    if (heroMedia.src) {
      const assetId =
        heroMedia.assetId ??
        getStudioAssetIdFromRef(heroMedia.src) ??
        createStudioAssetId(draft.id, "hero", "main");
      try {
        const src = await cacheStudioSource(assetId, heroMedia.src);
        if (src && !src.startsWith(STUDIO_ASSET_REF_PREFIX)) {
          heroMedia.src = src;
          heroMedia.assetId = assetId;
        }
      } catch {
        // Preserve the original public or inline source when caching fails.
      }
    }
    for (const card of draft.content.cards) {
      const assetId =
        card.imageAssetId ??
        getStudioAssetIdFromRef(card.image) ??
        (card.image
          ? createStudioAssetId(draft.id, "card", card.id)
          : undefined);
      if (!assetId) continue;
      try {
        const src = await cacheStudioSource(assetId, card.image ?? "");
        if (src && !src.startsWith(STUDIO_ASSET_REF_PREFIX)) {
          card.image = src;
          card.imageAssetId = assetId;
        }
      } catch {
        // Preserve the original public or inline source when caching fails.
      }
    }

    const composition = draft.pack.assets.collectionHeroComposition;
    if (!composition) continue;
    if (composition.finalReference?.src) {
      const assetId =
        composition.finalReference.assetId ??
        getStudioAssetIdFromRef(composition.finalReference.src) ??
        createStudioAssetId(draft.id, "hero-end", "main");
      try {
        const src = await cacheStudioSource(
          assetId,
          composition.finalReference.src,
        );
        if (src && !src.startsWith(STUDIO_ASSET_REF_PREFIX)) {
          composition.finalReference.src = src;
          composition.finalReference.assetId = assetId;
        }
      } catch {
        // Preserve the original public or inline source when caching fails.
      }
    }
    for (const layer of composition.layers) {
      if (layer.media?.src) {
        const assetId =
          layer.media.assetId ??
          getStudioAssetIdFromRef(layer.media.src) ??
          createStudioAssetId(draft.id, "hero-layer", layer.cardId);
        try {
          const src = await cacheStudioSource(assetId, layer.media.src);
          if (src && !src.startsWith(STUDIO_ASSET_REF_PREFIX)) {
            layer.media.src = src;
            layer.media.assetId = assetId;
          }
        } catch {
          // Preserve the original public or inline source when caching fails.
        }
      }
      if (layer.transitionMedia?.src) {
        const assetId =
          layer.transitionMedia.assetId ??
          getStudioAssetIdFromRef(layer.transitionMedia.src) ??
          createStudioAssetId(draft.id, "transition", layer.cardId);
        try {
          const src = await cacheStudioSource(
            assetId,
            layer.transitionMedia.src,
          );
          if (src && !src.startsWith(STUDIO_ASSET_REF_PREFIX)) {
            layer.transitionMedia.src = src;
            layer.transitionMedia.assetId = assetId;
          }
        } catch {
          // Preserve the original public or inline source when caching fails.
        }
      }
      if (
        layer.transitionMedia?.type === "video" &&
        layer.transitionMedia.poster
      ) {
        const posterAssetId =
          layer.transitionMedia.posterAssetId ??
          getStudioAssetIdFromRef(layer.transitionMedia.poster) ??
          createStudioAssetId(
            draft.id,
            "transition-poster",
            layer.cardId,
          );
        try {
          const poster = await cacheStudioSource(
            posterAssetId,
            layer.transitionMedia.poster,
          );
          if (poster && !poster.startsWith(STUDIO_ASSET_REF_PREFIX)) {
            layer.transitionMedia.poster = poster;
            layer.transitionMedia.posterAssetId = posterAssetId;
          }
        } catch {
          // Preserve the original public or inline source when caching fails.
        }
      }
    }
  }
  return drafts;
}

function serializeDraftAssets(sourceDrafts: CampaignSkinDraft[]) {
  const drafts = cloneValue(sourceDrafts);
  for (const draft of drafts) {
    if (draft.pack.assets.heroMedia.assetId) {
      draft.pack.assets.heroMedia.src = getStudioAssetRef(
        draft.pack.assets.heroMedia.assetId,
      );
    }
    for (const card of draft.content.cards) {
      if (card.imageAssetId) {
        card.image = getStudioAssetRef(card.imageAssetId);
      }
    }
    const composition = draft.pack.assets.collectionHeroComposition;
    if (!composition) continue;
    if (composition.finalReference?.assetId) {
      composition.finalReference.src = getStudioAssetRef(
        composition.finalReference.assetId,
      );
    }
    for (const layer of composition.layers) {
      if (layer.media?.assetId) {
        layer.media.src = getStudioAssetRef(layer.media.assetId);
      }
      if (layer.transitionMedia?.assetId) {
        layer.transitionMedia.src = getStudioAssetRef(
          layer.transitionMedia.assetId,
        );
      }
      if (
        layer.transitionMedia?.type === "video" &&
        layer.transitionMedia.posterAssetId
      ) {
        layer.transitionMedia.poster = getStudioAssetRef(
          layer.transitionMedia.posterAssetId,
        );
      }
    }
  }
  return drafts;
}

function createDraft(
  baseTheme: ThemeId,
  options?: { id?: string; name?: string; updatedAt?: string },
): CampaignSkinDraft {
  return {
    version: 1,
    id:
      options?.id ??
      `${baseTheme}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name:
      options?.name ??
      `${THEMES[baseTheme].navLabel} · 新方案`,
    baseTheme,
    content: cloneValue(THEMES[baseTheme]),
    pack: cloneValue(THEME_PACKS[baseTheme]),
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeDraft(draft: CampaignSkinDraft): CampaignSkinDraft {
  const defaultPack = THEME_PACKS[draft.baseTheme];
  const validCardIds = new Set(
    THEMES[draft.baseTheme].cards.map((card) => card.id),
  );
  const normalizedCards = draft.content.cards.filter((card) =>
    validCardIds.has(card.id),
  );
  const normalizedTiers = draft.content.tiers.map((tier) => ({
    ...tier,
    threshold: Math.min(tier.threshold, normalizedCards.length),
  }));
  const shouldMigrateLegacySummerHero =
    draft.baseTheme === "summer" &&
    !draft.pack.assets.collectionHeroComposition &&
    draft.pack.assets.heroMedia.src ===
      "/theme-assets/summer/hero-scene-v2.png";
  const legacySummerStartFrameAssetId = createStudioAssetId(
    draft.id,
    "hero",
    "main",
  );
  const shouldMigrateSummerVideoStartFrame =
    draft.id === "starter-summer" &&
    draft.baseTheme === "summer" &&
    (draft.pack.assets.heroMedia.assetId ===
      legacySummerStartFrameAssetId ||
      getStudioAssetIdFromRef(draft.pack.assets.heroMedia.src) ===
        legacySummerStartFrameAssetId) &&
    (draft.pack.assets.heroMedia.sourceWidth !== 834 ||
      draft.pack.assets.heroMedia.sourceHeight !== 1112);
  const draftComposition =
    draft.pack.assets.collectionHeroComposition;
  const legacySummerEndFrameAssetId = createStudioAssetId(
    draft.id,
    "hero-end",
    "main",
  );
  const shouldMigrateSummerVideoEndFrame =
    draft.id === "starter-summer" &&
    draft.baseTheme === "summer" &&
    Boolean(draftComposition?.finalReference) &&
    (draftComposition?.finalReference?.assetId ===
      legacySummerEndFrameAssetId ||
      getStudioAssetIdFromRef(
        draftComposition?.finalReference?.src,
      ) === legacySummerEndFrameAssetId) &&
    (draftComposition?.finalReference?.sourceWidth !== 834 ||
      draftComposition?.finalReference?.sourceHeight !== 1112);
  const sourceComposition =
    draft.pack.assets.collectionHeroComposition ??
    cloneValue(defaultPack.assets.collectionHeroComposition);
  const normalizedComposition = sourceComposition
    ? {
        ...sourceComposition,
        initialUnlockedCardIds:
          sourceComposition.initialUnlockedCardIds.filter((cardId) =>
            validCardIds.has(cardId),
          ),
        layers: sourceComposition.layers
          .filter((layer) => validCardIds.has(layer.cardId))
          .map((layer) => ({
            ...layer,
            unlockMethod:
              layer.unlockMethod ??
              (sourceComposition.initialUnlockedCardIds.includes(
                layer.cardId,
              )
                ? "first-gift"
                : "draw"),
            presentation: layer.presentation ?? "image-layer",
          })),
      }
    : undefined;
  return {
    ...draft,
    content: {
      ...draft.content,
      cards: normalizedCards,
      tiers: normalizedTiers,
    },
    pack: {
      ...defaultPack,
      ...draft.pack,
      assets: {
        ...defaultPack.assets,
        ...draft.pack.assets,
        heroMedia:
          shouldMigrateLegacySummerHero ||
          shouldMigrateSummerVideoStartFrame
            ? cloneValue(defaultPack.assets.heroMedia)
            : draft.pack.assets.heroMedia,
        collectionHeroComposition: normalizedComposition
          ? {
              ...normalizedComposition,
              finalReference: shouldMigrateSummerVideoEndFrame
                ? cloneValue(
                    defaultPack.assets.collectionHeroComposition!
                      .finalReference!,
                  )
                : normalizedComposition.finalReference,
            }
          : undefined,
      },
      colors: {
        ...defaultPack.colors,
        ...draft.pack.colors,
      },
    },
  };
}

function createStarterDrafts(): CampaignSkinDraft[] {
  return [
    createDraft("summer", {
      id: "starter-summer",
      name: "夏天马上顺 · 默认",
      updatedAt: DEFAULT_UPDATED_AT,
    }),
    createDraft("night", {
      id: "starter-night",
      name: "夏日夜食 · 默认",
      updatedAt: DEFAULT_UPDATED_AT,
    }),
  ];
}

function isDraft(input: unknown): input is CampaignSkinDraft {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<CampaignSkinDraft>;
  return Boolean(
    candidate.version === 1 &&
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      (candidate.baseTheme === "summer" ||
        candidate.baseTheme === "night") &&
      candidate.content &&
      Array.isArray(candidate.content.cards) &&
      Array.isArray(candidate.content.tiers) &&
      candidate.pack?.assets?.heroMedia &&
      candidate.pack?.colors,
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => reject(new Error("无法读取图片尺寸"));
    image.src = src;
  });
}

async function readImageAsset(file: File) {
  const src = await readFileAsDataUrl(file);
  const size = await readImageSize(src);
  return { src, ...size };
}

function readVideoSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    video.onerror = () => reject(new Error("无法读取视频尺寸"));
    video.src = src;
  });
}

function isTypingTarget(target: EventTarget | null) {
  return Boolean(
    target instanceof Element &&
      target.closest(
        "input, textarea, select, button, a[href], summary, [contenteditable='true']",
      ),
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorValue = /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : "#ffffff";
  return (
    <label className="studio-color-field">
      <input
        type="color"
        value={colorValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label}取色器`}
      />
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

function SectionSummary({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <summary>
      <span className="studio-section-index">{index}</span>
      <span className="studio-section-title">{children}</span>
      <span className="studio-details-affordance" aria-hidden="true">
        <span className="studio-details-collapsed">展开</span>
        <span className="studio-details-expanded">收起</span>
        <i />
      </span>
    </summary>
  );
}

function AssetPreview({
  src,
  fallback,
  alt,
  variant,
  displaySize,
  recommended,
  sourceWidth,
  sourceHeight,
  testId,
  sizeHintTestId,
}: {
  src?: string;
  fallback: ReactNode;
  alt: string;
  variant: "card" | "coupon" | "grand";
  displaySize: string;
  recommended: string;
  sourceWidth?: number;
  sourceHeight?: number;
  testId?: string;
  sizeHintTestId?: string;
}) {
  return (
    <div className={`studio-asset-preview ${variant}`}>
      <div className={`studio-asset-preview-frame ${variant}`}>
        {src ? (
          <img src={src} alt={alt} data-testid={testId} />
        ) : (
          <span aria-hidden="true">{fallback}</span>
        )}
      </div>
      <div className="studio-asset-preview-copy">
        <strong>
          {src
            ? "当前页面素材"
            : variant === "coupon"
              ? "当前为模板实时样式"
              : "当前使用 Emoji 兜底"}
        </strong>
        <span data-testid={sizeHintTestId}>
          页面展示容器：{displaySize}
        </span>
        {sourceWidth && sourceHeight ? (
          <span>
            当前文件：{sourceWidth} × {sourceHeight} px
          </span>
        ) : null}
        <small>{recommended}</small>
      </div>
    </div>
  );
}

const HERO_COMPOSER_DESIGN_HEIGHT = 500;

function HeroLayerComposer({
  baseMedia,
  layers,
  selectedLayerId,
  onSelect,
  onCommit,
}: {
  baseMedia: CampaignHeroMedia;
  layers: CampaignCollectionHeroLayer[];
  selectedLayerId: string;
  onSelect: (layerId: string) => void;
  onCommit: (
    layerId: string,
    patch: Partial<CampaignCollectionHeroLayer>,
  ) => void;
}) {
  const [transient, setTransient] = useState<{
    layerId: string;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const transientRef = useRef<{
    layerId: string;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const interactionRef = useRef<{
    pointerId: number;
    layerId: string;
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    rectWidth: number;
    rectHeight: number;
  } | null>(null);
  const compositionLayers = layers
    .filter(
      (layer) =>
        (layer.presentation ?? "image-layer") !== "none" &&
        layer.media?.src &&
        !layer.embeddedInBase,
    )
    .sort((left, right) => left.zIndex - right.zIndex);
  function beginLayerInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: CampaignCollectionHeroLayer,
    mode: "move" | "resize",
  ) {
    if (!layer.media?.src || layer.embeddedInBase) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(layer.id);
    const canvas = event.currentTarget.closest(
      ".studio-hero-composer-canvas",
    );
    if (!(canvas instanceof HTMLElement)) return;
    const rect = canvas.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      pointerId: event.pointerId,
      layerId: layer.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
    const nextFrame = {
      layerId: layer.id,
      x: layer.x,
      y: layer.y,
      width: layer.width,
    };
    transientRef.current = nextFrame;
    setTransient(nextFrame);
  }

  function moveLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX =
      ((event.clientX - interaction.startClientX) /
        interaction.rectWidth) *
      375;
    const deltaY =
      ((event.clientY - interaction.startClientY) /
        interaction.rectHeight) *
      HERO_COMPOSER_DESIGN_HEIGHT;
    if (interaction.mode === "resize") {
      const nextFrame = {
        layerId: interaction.layerId,
        x: interaction.startX,
        y: interaction.startY,
        width: Math.max(16, interaction.startWidth + deltaX),
      };
      transientRef.current = nextFrame;
      setTransient(nextFrame);
      return;
    }
    const nextFrame = {
      layerId: interaction.layerId,
      x: interaction.startX + deltaX,
      y: interaction.startY + deltaY,
      width: interaction.startWidth,
    };
    transientRef.current = nextFrame;
    setTransient(nextFrame);
  }

  function finishLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finalFrame = transientRef.current;
    if (finalFrame?.layerId === interaction.layerId) {
      onCommit(interaction.layerId, {
        x: Math.round(finalFrame.x * 10) / 10,
        y: Math.round(finalFrame.y * 10) / 10,
        width: Math.round(finalFrame.width * 10) / 10,
      });
    }
    interactionRef.current = null;
    transientRef.current = null;
    setTransient(null);
  }

  function renderMedia(
    media: CampaignHeroMedia,
    className: string,
    alt = "",
  ) {
    const style: CSSProperties = {
      objectFit: media.fit ?? "cover",
      objectPosition: media.position ?? "center top",
    };
    return media.type === "video" ? (
      <video
        className={className}
        src={media.src}
        poster={media.poster}
        style={style}
        autoPlay
        muted
        loop
        playsInline
      />
    ) : (
      <img className={className} src={media.src} alt={alt} style={style} />
    );
  }

  return (
    <div
      className="studio-hero-composer-canvas"
      data-testid="config-hero-layer-canvas"
      data-composition-layer-count={compositionLayers.length}
    >
      {renderMedia(baseMedia, "studio-hero-composer-base", "Hero 基础图")}
      {compositionLayers.map((layer) => {
        const frame =
          transient?.layerId === layer.id ? transient : layer;
        const selected = selectedLayerId === layer.id;
        return (
          <div
            className={`studio-hero-composer-layer ${
              selected ? "selected" : ""
            }`}
            style={{
              left: `${(frame.x / 375) * 100}%`,
              top: `${(frame.y / HERO_COMPOSER_DESIGN_HEIGHT) * 100}%`,
              width: `${(frame.width / 375) * 100}%`,
              zIndex: layer.zIndex + 2,
              transform: `rotate(${layer.rotation}deg)`,
            }}
            onPointerDown={(event) =>
              beginLayerInteraction(event, layer, "move")
            }
            onPointerMove={moveLayerInteraction}
            onPointerUp={finishLayerInteraction}
            onPointerCancel={finishLayerInteraction}
            data-card-id={layer.cardId}
            key={layer.id}
          >
            {renderMedia(
              layer.media!,
              "studio-hero-composer-layer-media",
              "",
            )}
            {selected && (
              <>
                <span className="studio-hero-composer-label">
                  {layer.label}
                </span>
                <button
                  type="button"
                  className="studio-hero-composer-resize"
                  aria-label={`缩放${layer.label}`}
                  onPointerDown={(event) =>
                    beginLayerInteraction(event, layer, "resize")
                  }
                  onPointerMove={moveLayerInteraction}
                  onPointerUp={finishLayerInteraction}
                  onPointerCancel={finishLayerInteraction}
                />
              </>
            )}
          </div>
        );
      })}
      <span className="studio-hero-composer-size">375 × 500</span>
    </div>
  );
}

export default function CampaignStudio() {
  const [drafts, setDrafts] =
    useState<CampaignSkinDraft[]>(createStarterDrafts);
  const [activeId, setActiveId] = useState("starter-summer");
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("修改会即时出现在手机预览中");
  const [importError, setImportError] = useState("");
  const [h5EditMode, setH5EditMode] = useState(true);
  const [previewSessionId, setPreviewSessionId] = useState(0);
  const [canvasMode, setCanvasMode] =
    useState<StudioCanvasMode>("page");
  const [selectedPageId, setSelectedPageId] =
    useState("campaign-main");
  const [heroLayerEditId, setHeroLayerEditId] =
    useState("hero-layer-watergun");
  const [flowEdges, setFlowEdges] = useState<CampaignFlowEdge[]>(
    () => cloneValue(CAMPAIGN_FLOW_EDGES),
  );
  const [aiTarget, setAiTarget] = useState<AiTarget | null>(null);
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_HERO_AI_PROMPT);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiReferences, setAiReferences] = useState<AiReference[]>([]);
  const [lastAiPrompt, setLastAiPrompt] = useState("");
  const [aiCandidateGroups, setAiCandidateGroups] = useState<
    AiCandidateGroup[]
  >([]);
  const [selectedAiAsset, setSelectedAiAsset] =
    useState<SelectedAiAsset | null>(null);
  const [aiTrial, setAiTrial] = useState<AiTrial | null>(null);
  const [adoptedCandidateId, setAdoptedCandidateId] = useState<
    string | null
  >(null);
  const [adoptedGroupId, setAdoptedGroupId] = useState<string | null>(
    null,
  );
  const [lastAiCommit, setLastAiCommit] =
    useState<AiCommitHistory | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(0.72);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const fitModeRef = useRef(true);
  const previewWorldRef = useRef<HTMLDivElement>(null);
  const canvasSceneRef = useRef<HTMLDivElement>(null);
  const phoneViewportRef = useRef<HTMLDivElement>(null);
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);
  const aiJobIdRef = useRef(0);
  const aiTimerRef = useRef<number | null>(null);
  const canvasDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const candidateGroupDragRef = useRef<{
    pointerId: number;
    groupId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    zoom: number;
  } | null>(null);

  const activeDraft =
    drafts.find((draft) => draft.id === activeId) ?? drafts[0];
  const collectionHeroComposition =
    activeDraft.pack.assets.collectionHeroComposition;
  const heroLayers = collectionHeroComposition?.layers ?? [];
  const heroTransitionLibrary = createHeroTransitionLibrary(heroLayers);
  const selectedHeroLayer =
    heroLayers.find((layer) => layer.id === heroLayerEditId) ??
    heroLayers[0] ??
    null;
  const selectedHeroTransitionKey = getHeroTransitionMediaKey(
    selectedHeroLayer?.transitionMedia,
  );
  const selectedHeroCard = selectedHeroLayer
    ? activeDraft.content.cards.find(
        (card) => card.id === selectedHeroLayer.cardId,
      ) ?? null
    : null;
  const selectedHeroCardIndex = selectedHeroLayer
    ? activeDraft.content.cards.findIndex(
        (card) => card.id === selectedHeroLayer.cardId,
      )
    : -1;
  const configuredHeroLayerCount = heroLayers.filter(
    (layer) => Boolean(layer.media?.src) || layer.embeddedInBase,
  ).length;
  const h5HeroLayerPreviewCardIds =
    collectionHeroComposition?.initialUnlockedCardIds ?? [];
  const previewDraft = useMemo(() => {
    if (!aiTrial || aiTrial.target.draftId !== activeDraft.id) {
      return activeDraft;
    }
    return applyAiCandidateToDraft(
      activeDraft,
      aiTrial.target,
      aiTrial.candidate,
    );
  }, [activeDraft, aiTrial]);
  const runtimeConfiguration = useMemo(
    () => createConfigurationFromSkin(previewDraft),
    [previewDraft],
  );
  const selectedCandidateGroup = selectedAiAsset
    ? aiCandidateGroups.find(
        (group) => group.id === selectedAiAsset.groupId,
      ) ?? null
    : null;
  const selectedCandidate = selectedCandidateGroup
    ? selectedCandidateGroup.candidates.find(
        (candidate) => candidate.id === selectedAiAsset?.candidateId,
      ) ?? null
    : null;
  const selectedPage =
    CAMPAIGN_PAGES.find((page) => page.id === selectedPageId) ??
    CAMPAIGN_PAGES[2];
  const inspectorOpen = true;
  const previewMode = !h5EditMode;
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!activeDraft.pack.assets.heroMedia.src) issues.push("缺少 Hero");
    if (
      activeDraft.content.cards.length !==
      THEMES[activeDraft.baseTheme].cards.length
    ) {
      issues.push("卡片数量与主题模板不一致");
    }
    if (activeDraft.content.tiers.length !== 4) issues.push("奖励不是 4 档");
    if (activeDraft.content.topicChips.length !== 6) {
      issues.push("话题标签不是 6 个");
    }
    if (activeDraft.content.activityBanners.length !== 2) {
      issues.push("Banner 不是 2 个");
    }
    if (
      activeDraft.content.tiers.some(
        (tier, index, tiers) =>
          index > 0 && tier.threshold <= tiers[index - 1].threshold,
      )
    ) {
      issues.push("奖励门槛未递增");
    }
    const composition =
      activeDraft.pack.assets.collectionHeroComposition;
    if (composition?.enabled) {
      const cardIds = composition.layers.map((layer) => layer.cardId);
      if (
        new Set(cardIds).size !== cardIds.length ||
        cardIds.some(
          (cardId) =>
            !activeDraft.content.cards.some((card) => card.id === cardId),
        )
      ) {
        issues.push("Hero 图层与道具卡 ID 映射异常");
      }
      if (
        composition.layers.some(
          (layer) =>
            !Number.isFinite(layer.x) ||
            !Number.isFinite(layer.y) ||
            !Number.isFinite(layer.width) ||
            layer.width < 8 ||
            layer.width > 750,
        )
      ) {
        issues.push("Hero 道具图层位置或尺寸异常");
      }
    }
    return issues;
  }, [activeDraft]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        let nextDrafts = createStarterDrafts();
        const saved = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const validDrafts = parsed.filter(isDraft).map(normalizeDraft);
            if (validDrafts.length > 0) {
              nextDrafts = validDrafts;
            }
          }
        }
        const hydratedDrafts = await hydrateAndCacheDraftAssets(nextDrafts);
        setDrafts(hydratedDrafts);
        setActiveId(hydratedDrafts[0].id);
        setMessage("道具素材槽已接入本地缓存");
      } catch {
        setMessage("本地草稿读取失败，已恢复默认方案");
      } finally {
        setHydrated(true);
      }
    };
    void loadDrafts();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        DRAFTS_STORAGE_KEY,
        JSON.stringify(serializeDraftAssets(drafts)),
      );
    } catch {
      window.queueMicrotask(() =>
        setMessage("草稿素材较大，请及时导出 JSON 备份"),
      );
    }
  }, [drafts, hydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !h5EditMode) {
        event.preventDefault();
        setH5EditMode(true);
        setMessage("已返回编辑态");
        return;
      }
      if (
        event.code !== "Space" ||
        isTypingTarget(event.target) ||
        event.repeat
      ) {
        return;
      }
      event.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      canvasDragRef.current = null;
    };
    const handleBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      canvasDragRef.current = null;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [h5EditMode]);

  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>(
        ".studio-inspector > :not(.studio-inspector-workbar)",
      )
      .forEach((element) => {
        if (previewMode) {
          element.setAttribute("inert", "");
        } else {
          element.removeAttribute("inert");
        }
      });
  }, [previewMode]);

  function clampCanvasZoom(value: number) {
    return Math.min(
      CANVAS_MAX_ZOOM,
      Math.max(CANVAS_MIN_ZOOM, value),
    );
  }

  function calculateCanvasFitZoom() {
    return calculateCanvasFitLayout().zoom;
  }

  function calculateCanvasFitLayout() {
    const world = previewWorldRef.current;
    const scene = canvasSceneRef.current;
    if (!world || !scene) {
      return { zoom: 0.72, pan: { x: 0, y: 0 } };
    }
    const bounds = world.getBoundingClientRect();
    let minX = 0;
    let minY = 0;
    let maxX = scene.offsetWidth;
    let maxY = scene.offsetHeight;
    scene
      .querySelectorAll<HTMLElement>(".studio-ai-candidate-group")
      .forEach((group) => {
        if (group.offsetWidth === 0 || group.offsetHeight === 0) return;
        const match = group.style.transform.match(
          /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\)/,
        );
        const x = Number(match?.[1] ?? 0);
        const y = Number(match?.[2] ?? 0);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + group.offsetWidth);
        maxY = Math.max(maxY, y + group.offsetHeight);
      });
    const zoom = Math.min(
      1,
      Math.max(
        CANVAS_MIN_ZOOM,
        Math.min(
          (bounds.width - 96) / (maxX - minX),
          (bounds.height - 108) / (maxY - minY),
        ),
      ),
    );
    return {
      zoom,
      pan: {
        x: (scene.offsetWidth / 2 - (minX + maxX) / 2) * zoom,
        y: (scene.offsetHeight / 2 - (minY + maxY) / 2) * zoom,
      },
    };
  }

  useEffect(() => {
    const world = previewWorldRef.current;
    const scene = canvasSceneRef.current;
    if (!world || !scene) return;
    const updateFit = () => {
      if (!fitModeRef.current) return;
      const layout = calculateCanvasFitLayout();
      setCanvasZoom(layout.zoom);
      setCanvasPan(layout.pan);
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(world);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fitModeRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const layout = calculateCanvasFitLayout();
      setCanvasZoom(layout.zoom);
      setCanvasPan(layout.pan);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, canvasMode]);

  useEffect(() => {
    aiJobIdRef.current += 1;
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    const frame = window.requestAnimationFrame(() => {
      setAiTarget(null);
      setAiStatus("idle");
      setAiCandidateGroups([]);
      setSelectedAiAsset(null);
      setAiReferences([]);
      setAiTrial(null);
      setAdoptedCandidateId(null);
      setAdoptedGroupId(null);
      setHeroLayerEditId("hero-layer-watergun");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId]);

  useEffect(
    () => () => {
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
      }
    },
    [],
  );

  function adjustCanvasZoom(delta: number) {
    fitModeRef.current = false;
    setCanvasZoom((current) =>
      clampCanvasZoom(Math.round((current + delta) * 20) / 20),
    );
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    adjustCanvasZoom(event.deltaY > 0 ? -0.05 : 0.05);
  }

  function handleCanvasPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      !spaceHeldRef.current ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest(".studio-canvas-controls"))
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: canvasPan.x,
      panY: canvasPan.y,
    };
  }

  function handleCanvasPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = canvasDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCanvasPan({
      x: drag.panX + event.clientX - drag.startX,
      y: drag.panY + event.clientY - drag.startY,
    });
  }

  function handleCanvasPointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (canvasDragRef.current?.pointerId !== event.pointerId) return;
    canvasDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCandidateGroupPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    group: AiCandidateGroup,
  ) {
    if (event.button !== 0 || spaceHeldRef.current) return;
    fitModeRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    candidateGroupDragRef.current = {
      pointerId: event.pointerId,
      groupId: group.id,
      startX: event.clientX,
      startY: event.clientY,
      x: group.position.x,
      y: group.position.y,
      zoom: canvasZoom,
    };
  }

  function handleCandidateGroupPointerMove(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const drag = candidateGroupDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setAiCandidateGroups((current) =>
      current.map((group) =>
        group.id === drag.groupId
          ? {
              ...group,
              position: {
                x:
                  drag.x +
                  (event.clientX - drag.startX) / drag.zoom,
                y:
                  drag.y +
                  (event.clientY - drag.startY) / drag.zoom,
              },
            }
          : group,
      ),
    );
  }

  function handleCandidateGroupPointerEnd(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const drag = candidateGroupDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    candidateGroupDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function toggleCandidateGroup(groupId: string) {
    setAiCandidateGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? { ...group, collapsed: !group.collapsed }
          : group,
      ),
    );
  }

  function updateFlowEdge(
    edgeId: string,
    patch: Partial<CampaignFlowEdge>,
  ) {
    setFlowEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId ? { ...edge, ...patch } : edge,
      ),
    );
    setMessage("页面跳转草稿已更新；发布前会校验不可达页面与循环");
  }

  function updateActive(
    updater: (draft: CampaignSkinDraft) => CampaignSkinDraft,
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? {
              ...updater(draft),
              updatedAt: new Date().toISOString(),
            }
          : draft,
      ),
    );
  }

  function updateContent(
    patch: Partial<ThemeDefinition>,
  ) {
    updateActive((draft) => ({
      ...draft,
      content: {
        ...draft.content,
        ...patch,
      },
    }));
  }

  function updatePackColor(key: PackColorKey, value: string) {
    updateActive((draft) => ({
      ...draft,
      pack: {
        ...draft.pack,
        colors: {
          ...draft.pack.colors,
          [key]: value,
        },
      },
    }));
  }

  function updatePackAsset(key: PackAssetKey, value: string) {
    updateActive((draft) => ({
      ...draft,
      pack: {
        ...draft.pack,
        assets: {
          ...draft.pack.assets,
          [key]: value || undefined,
        },
      },
    }));
  }

  function updateCollectionHeroComposition(
    updater: (
      composition: CampaignCollectionHeroComposition,
    ) => CampaignCollectionHeroComposition,
  ) {
    updateActive((draft) => {
      const currentComposition =
        draft.pack.assets.collectionHeroComposition ??
        cloneValue(
          THEME_PACKS[draft.baseTheme].assets
            .collectionHeroComposition,
        );
      if (!currentComposition) return draft;
      return {
        ...draft,
        pack: {
          ...draft.pack,
          assets: {
            ...draft.pack.assets,
            collectionHeroComposition: updater(currentComposition),
          },
        },
      };
    });
  }

  function updateHeroLayer(
    layerId: string,
    patch: Partial<CampaignCollectionHeroLayer>,
  ) {
    updateCollectionHeroComposition((composition) => ({
      ...composition,
      layers: composition.layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    }));
  }

  function updateHeroLayerPresentation(
    layer: CampaignCollectionHeroLayer,
    presentation: NonNullable<
      CampaignCollectionHeroLayer["presentation"]
    >,
  ) {
    const reusableTransition =
      presentation === "video-transition" &&
      !getHeroTransitionMediaKey(layer.transitionMedia)
        ? heroTransitionLibrary[0]
        : undefined;
    updateHeroLayer(layer.id, {
      presentation,
      embeddedInBase:
        presentation === "image-layer" ? layer.embeddedInBase : false,
      ...(reusableTransition
        ? { transitionMedia: cloneValue(reusableTransition.media) }
        : {}),
    });
    if (reusableTransition) {
      setMessage(
        `已为「${layer.label}」复用「${reusableTransition.sourceLabels.join("、")}」的过场动画`,
      );
    }
  }

  function reuseHeroTransition(
    layer: CampaignCollectionHeroLayer,
    transition: HeroTransitionLibraryItem,
  ) {
    updateHeroLayer(layer.id, {
      presentation: "video-transition",
      embeddedInBase: false,
      transitionMedia: cloneValue(transition.media),
    });
    setMessage(
      `「${layer.label}」将复用「${transition.sourceLabels.join("、")}」的过场动画`,
    );
  }

  function updateHeroLayerUnlockMethod(
    layer: CampaignCollectionHeroLayer,
    unlockMethod: NonNullable<
      CampaignCollectionHeroLayer["unlockMethod"]
    >,
  ) {
    updateCollectionHeroComposition((composition) => ({
      ...composition,
      initialUnlockedCardIds:
        unlockMethod === "first-gift"
          ? Array.from(
              new Set([
                ...composition.initialUnlockedCardIds,
                layer.cardId,
              ]),
            )
          : composition.initialUnlockedCardIds.filter(
              (cardId) => cardId !== layer.cardId,
            ),
      layers: composition.layers.map((item) =>
        item.id === layer.id
          ? {
              ...item,
              unlockMethod,
              pointsCost:
                unlockMethod === "points"
                  ? item.pointsCost ?? 100
                  : item.pointsCost,
            }
          : item,
      ),
    }));
  }

  async function uploadHeroLayer(
    layerId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const currentLayer =
        activeDraft.pack.assets.collectionHeroComposition?.layers.find(
          (layer) => layer.id === layerId,
        );
      if (!currentLayer) throw new Error("图层不存在");
      const assetId = createStudioAssetId(
        activeDraft.id,
        "hero-layer",
        currentLayer.cardId,
      );
      const src = await cacheStudioFile(assetId, file);
      const size = await readImageSize(src);
      updateHeroLayer(layerId, {
        embeddedInBase: false,
        presentation:
          currentLayer.presentation === "video-transition"
            ? "video-transition"
            : "image-layer",
        media: {
          type: "image",
          src,
          assetId,
          sourceWidth: size.width,
          sourceHeight: size.height,
          fit: "contain",
          position: "center",
        },
      });
      setMessage(
        `已替换「${currentLayer?.label ?? "Hero 道具图层"}」透明素材`,
      );
    } catch {
      setMessage("Hero 道具图层读取失败");
    }
  }

  async function uploadHeroTransitionVideo(
    layerId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const layer =
        activeDraft.pack.assets.collectionHeroComposition?.layers.find(
          (item) => item.id === layerId,
        );
      if (!layer) throw new Error("图层不存在");
      const assetId = createStudioAssetId(
        activeDraft.id,
        "transition",
        layer.cardId,
      );
      const src = await cacheStudioFile(assetId, file);
      const size = await readVideoSize(src);
      updateHeroLayer(layerId, {
        embeddedInBase: false,
        presentation: "video-transition",
        transitionMedia: {
          type: "video",
          src,
          assetId,
          poster:
            layer?.transitionMedia?.type === "video"
              ? layer.transitionMedia.poster
              : undefined,
          posterAssetId:
            layer?.transitionMedia?.type === "video"
              ? layer.transitionMedia.posterAssetId
              : undefined,
          sourceWidth: size.width,
          sourceHeight: size.height,
          fit: activeDraft.pack.assets.heroMedia.fit ?? "cover",
          position:
            activeDraft.pack.assets.heroMedia.position ?? "center top",
        },
      });
      setMessage("视频过场已载入");
    } catch {
      setMessage("视频过场读取失败");
    }
  }

  async function uploadHeroTransitionPoster(
    layerId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const layer =
        activeDraft.pack.assets.collectionHeroComposition?.layers.find(
          (item) => item.id === layerId,
        );
      if (!layer) throw new Error("图层不存在");
      const posterAssetId = createStudioAssetId(
        activeDraft.id,
        "transition-poster",
        layer.cardId,
      );
      const poster = await cacheStudioFile(posterAssetId, file);
      updateHeroLayer(layerId, {
        transitionMedia: {
          type: "video",
          src:
            layer?.transitionMedia?.type === "video"
              ? layer.transitionMedia.src
              : "",
          poster,
          posterAssetId,
          sourceWidth: layer?.transitionMedia?.sourceWidth,
          sourceHeight: layer?.transitionMedia?.sourceHeight,
          fit: activeDraft.pack.assets.heroMedia.fit ?? "cover",
          position:
            activeDraft.pack.assets.heroMedia.position ?? "center top",
        },
      });
      setMessage("视频封面已载入");
    } catch {
      setMessage("视频封面读取失败");
    }
  }

  function updateCard(index: number, patch: Partial<CardDefinition>) {
    updateActive((draft) => {
      const cards = draft.content.cards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, ...patch } : card,
      );
      return {
        ...draft,
        content: {
          ...draft.content,
          cards,
        },
      };
    });
  }

  function updateTier(index: number, patch: Partial<TierDefinition>) {
    updateActive((draft) => {
      const tiers = draft.content.tiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      );
      return {
        ...draft,
        content: {
          ...draft.content,
          tiers,
        },
      };
    });
  }

  function updateTask(
    index: number,
    patch: Partial<ThemeDefinition["tasks"][number]>,
  ) {
    updateActive((draft) => ({
      ...draft,
      content: {
        ...draft.content,
        tasks: draft.content.tasks.map((task, taskIndex) =>
          taskIndex === index ? { ...task, ...patch } : task,
        ),
      },
    }));
  }

  function updateInspirationCard(
    index: number,
    patch: Partial<ThemeDefinition["inspirationCards"][number]>,
  ) {
    updateActive((draft) => ({
      ...draft,
      content: {
        ...draft.content,
        inspirationCards: draft.content.inspirationCards.map(
          (card, cardIndex) =>
            cardIndex === index ? { ...card, ...patch } : card,
        ),
      },
    }));
  }

  function updateVenue(
    index: number,
    patch: Partial<ThemeDefinition["venues"][number]>,
  ) {
    updateActive((draft) => ({
      ...draft,
      content: {
        ...draft.content,
        venues: draft.content.venues.map((venue, venueIndex) =>
          venueIndex === index ? { ...venue, ...patch } : venue,
        ),
      },
    }));
  }

  function updateTierAsset(
    index: number,
    patch: Pick<
      TierDefinition,
      "image" | "imageWidth" | "imageHeight"
    >,
  ) {
    updateActive((draft) => {
      const selectedTier = draft.content.tiers[index];
      const tiers = draft.content.tiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      );
      return {
        ...draft,
        content: {
          ...draft.content,
          tiers,
        },
        pack:
          selectedTier.kind === "grand"
            ? {
                ...draft.pack,
                assets: {
                  ...draft.pack.assets,
                  grandRewardImage: patch.image,
                },
              }
            : draft.pack,
      };
    });
  }

  function selectAiTarget(target: AiTarget | null) {
    setAiTarget(target);
    setSelectedAiAsset(null);
    setH5EditMode(true);
    setCanvasMode("page");
    if (target) {
      setSelectedPageId(target.pageId);
      setAiPrompt((current) => {
        if (
          target.kind === "collection-kit" &&
          (current.trim() === "" || current === DEFAULT_HERO_AI_PROMPT)
        ) {
          return DEFAULT_COLLECTION_AI_PROMPT;
        }
        if (
          target.kind === "hero" &&
          (current.trim() === "" ||
            current === DEFAULT_COLLECTION_AI_PROMPT)
        ) {
          return DEFAULT_HERO_AI_PROMPT;
        }
        return current;
      });
      setMessage(`已把「${target.label}」约束挂到左侧 Chat`);
    } else {
      setMessage("已切换为自由生成；候选不会自动写入 H5");
    }
    window.requestAnimationFrame(() => aiPromptRef.current?.focus());
  }

  async function handleAiReferenceUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    event.target.value = "";
    if (files.length === 0) return;
    try {
      const assets = await Promise.all(
        files.map(async (file, index) => {
          const asset = await readImageAsset(file);
          return {
            id: `reference-${Date.now()}-${index}`,
            name: file.name,
            ...asset,
          };
        }),
      );
      setAiReferences((current) => [...current, ...assets].slice(0, 4));
      setMessage(`已添加 ${assets.length} 张参考图到本次生成上下文`);
      window.requestAnimationFrame(() => aiPromptRef.current?.focus());
    } catch {
      setMessage("参考图读取失败，请使用常见图片格式");
    }
  }

  function removeAiReference(referenceId: string) {
    setAiReferences((current) =>
      current.filter((reference) => reference.id !== referenceId),
    );
  }

  function runAiGeneration() {
    if (aiStatus === "generating") return;
    const prompt = aiPrompt.trim() || "沿用当前主题生成一组可用素材";
    const jobId = aiJobIdRef.current + 1;
    aiJobIdRef.current = jobId;
    const draftSnapshot = cloneValue(activeDraft);
    const targetSnapshot = aiTarget ? cloneValue(aiTarget) : null;
    const references = cloneValue(aiReferences);
    const pageId = targetSnapshot?.pageId ?? selectedPageId;
    setAiStatus("generating");
    setLastAiPrompt(prompt);
    setSelectedAiAsset(null);
    setAiTrial(null);
    setAdoptedCandidateId(null);
    setAdoptedGroupId(null);
    setMessage(
      targetSnapshot
        ? `正在为「${targetSnapshot.label}」生成：「${prompt.slice(0, 18)}${prompt.length > 18 ? "…" : ""}」`
        : `正在自由生成：「${prompt.slice(0, 18)}${prompt.length > 18 ? "…" : ""}」`,
    );
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
    }
    aiTimerRef.current = window.setTimeout(() => {
      if (aiJobIdRef.current !== jobId) return;
      const candidates = createMockAiCandidates(
        draftSnapshot,
        targetSnapshot,
      );
      const batch: M2BatchCandidate | undefined =
        targetSnapshot?.kind === "collection-kit"
          ? {
              id: `m2-batch-${jobId}-${Date.now()}`,
              kind: "m2-batch",
              draftId: draftSnapshot.id,
              pageId,
              cardCount: draftSnapshot.content.cards.length,
              rewardCount: 4,
              assets: candidates,
            }
          : undefined;
      const canvasWidth = previewWorldRef.current?.clientWidth ?? 1200;
      const groupWidth = batch ? 760 : 468;
      const groupX = -(groupWidth + 36);
      if (fitModeRef.current) {
        const widestGroup = Math.max(
          groupWidth,
          ...aiCandidateGroups.map((group) =>
            group.target?.kind === "collection-kit" ? 760 : 468,
          ),
        );
        const combinedWidth = widestGroup + 36 + 395;
        const nextZoom = Math.min(
          calculateCanvasFitZoom(),
          clampCanvasZoom((canvasWidth - 96) / combinedWidth),
        );
        setCanvasZoom(nextZoom);
        setCanvasPan({
          x: ((widestGroup + 36) / 2) * nextZoom,
          y: 0,
        });
      }
      setAiCandidateGroups((current) => [
        ...current,
        {
          id: `candidate-group-${jobId}-${Date.now()}`,
          draftId: draftSnapshot.id,
          pageId,
          prompt,
          target: targetSnapshot,
          references,
          candidates,
          batch,
          position: {
            x: groupX + (current.length % 2) * 22,
            y:
              56 +
              current.reduce(
                (total, group) =>
                  total +
                  (group.target?.kind === "collection-kit"
                    ? 430
                    : 286),
                0,
              ),
          },
          collapsed: false,
        },
      ]);
      setAiStatus("ready");
      setMessage(
        targetSnapshot
          ? targetSnapshot.kind === "collection-kit"
            ? `已按模块契约生成 ${draftSnapshot.content.cards.length} 张卡片与 ${draftSnapshot.content.tiers.length} 档奖励，并作为完整批次放进 Canvas`
            : `已把 ${candidates.length} 个「${targetSnapshot.label}」候选作为一组放进 Canvas`
          : "已把 3 个自由素材作为一组放进 Canvas",
      );
      aiTimerRef.current = null;
    }, 850);
  }

  function tryAiCandidate(
    candidate: AiCandidate,
    groupId: string,
    forcedTarget?: AiTarget,
  ) {
    const target = candidate.target ?? forcedTarget ?? aiTarget;
    if (!target) {
      setMessage("这个候选尚未绑定目标，请先选择 H5 素材槽");
      return;
    }
    if (target.draftId !== activeDraft.id) {
      setMessage("候选属于另一个方案，请重新生成或重新绑定");
      return;
    }
    const boundCandidate =
      candidate.target === target ? candidate : { ...candidate, target };
    setAiCandidateGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              candidates: group.candidates.map((item) =>
                item.id === candidate.id ? boundCandidate : item,
              ),
            }
          : group,
      ),
    );
    setAiTarget(target);
    setAiTrial({ groupId, target, candidate: boundCandidate });
    setSelectedAiAsset({ groupId, candidateId: candidate.id });
    setMessage(`正在 H5 中临时试用「${candidate.label}」`);
  }

  function cancelAiTrial() {
    setAiTrial(null);
    setMessage("已退出试用，当前草稿没有被修改");
  }

  function confirmAiTrial() {
    if (!aiTrial || aiTrial.target.draftId !== activeDraft.id) return;
    const before = cloneValue(activeDraft);
    const next = applyAiCandidateToDraft(
      activeDraft,
      aiTrial.target,
      aiTrial.candidate,
    );
    next.updatedAt = new Date().toISOString();
    setDrafts((current) =>
      current.map((draft) => (draft.id === activeDraft.id ? next : draft)),
    );
    setLastAiCommit({ draftId: activeDraft.id, before });
    setAdoptedCandidateId(aiTrial.candidate.id);
    setAdoptedGroupId(null);
    setAiTrial(null);
    setMessage("已确认到当前草稿；尚未应用到活动页");
  }

  function applyAiCandidateGroup(group: AiCandidateGroup) {
    if (!group.batch) return;
    try {
      const before = cloneValue(activeDraft);
      const next = applyM2BatchToDraft(activeDraft, group.batch);
      next.updatedAt = new Date().toISOString();
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === activeDraft.id ? next : draft,
        ),
      );
      setLastAiCommit({ draftId: activeDraft.id, before });
      setAdoptedCandidateId(null);
      setAdoptedGroupId(group.id);
      setAiTrial(null);
      setMessage(
        `已将 ${group.batch.cardCount} 张卡片和 ${group.batch.rewardCount} 档奖励作为一个原子批次引用到当前草稿`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `整组引用失败：${error.message}`
          : "整组引用失败",
      );
    }
  }

  function undoLastAiCommit() {
    if (!lastAiCommit || lastAiCommit.draftId !== activeDraft.id) return;
    const restored = cloneValue(lastAiCommit.before);
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === lastAiCommit.draftId ? restored : draft,
      ),
    );
    setLastAiCommit(null);
    setAdoptedCandidateId(null);
    setAdoptedGroupId(null);
    setAiTrial(null);
    setMessage("已撤销最近一次 AI 素材确认");
  }

  function duplicateActive() {
    const next: CampaignSkinDraft = {
      ...cloneValue(activeDraft),
      id: `${activeDraft.baseTheme}-${Date.now()}`,
      name: `${activeDraft.name} · 副本`,
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => [...current, next]);
    setActiveId(next.id);
    setMessage("已复制为新方案，可以开始整套换肤");
  }

  function addFromTheme(themeId: ThemeId) {
    const next = createDraft(themeId);
    setDrafts((current) => [...current, next]);
    setActiveId(next.id);
    setMessage(`已从「${THEMES[themeId].navLabel}」创建新方案`);
  }

  function resetActive() {
    const reset = createDraft(activeDraft.baseTheme, {
      id: activeDraft.id,
      name: activeDraft.name,
    });
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id ? reset : draft,
      ),
    );
    setMessage("已恢复来源主题的默认配置");
  }

  function deleteActive() {
    if (drafts.length <= 1) return;
    const remaining = drafts.filter(
      (draft) => draft.id !== activeDraft.id,
    );
    setDrafts(remaining);
    setActiveId(remaining[0].id);
    setMessage("方案已删除");
  }

  function persistActivePreviewDraft() {
    try {
      const previewDraft = serializeDraftAssets([activeDraft])[0];
      if (!previewDraft) throw new Error("活动配置不存在");
      window.localStorage.setItem(
        ACTIVE_SKIN_STORAGE_KEY,
        JSON.stringify(previewDraft),
      );
      return true;
    } catch {
      setMessage("活动预览配置保存失败");
      return false;
    }
  }

  function applyActive() {
    if (!persistActivePreviewDraft()) return;
    setMessage("已应用到活动页；打开或刷新活动页即可查看");
  }

  function openActivityPreview() {
    setCanvasMode("page");
    setSelectedPageId("campaign-main");
    setSelectedAiAsset(null);
    setPreviewSessionId((current) => current + 1);
    setH5EditMode(false);
    window.requestAnimationFrame(() => {
      phoneViewportRef.current?.scrollTo({ top: 0 });
    });
    setMessage("正在本页预览活动；按 Esc 或点击退出预览返回编辑");
  }

  function exitActivityPreview() {
    setH5EditMode(true);
    setMessage("已返回编辑态");
  }

  function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isDraft(parsed)) {
          throw new Error("配置结构不完整");
        }
        const importedDraft = {
          ...normalizeDraft(parsed),
          id: `${parsed.baseTheme}-${Date.now()}`,
          name: `${parsed.name} · 导入`,
          updatedAt: new Date().toISOString(),
        };
        const [imported] = await hydrateAndCacheDraftAssets([
          importedDraft,
        ]);
        setDrafts((current) => [...current, imported]);
        setActiveId(imported.id);
        setImportError("");
        setMessage("方案导入成功");
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "无法读取配置文件",
        );
      }
    };
    reader.readAsText(file);
  }

  async function uploadHero(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const assetId = createStudioAssetId(
        activeDraft.id,
        "hero",
        `main-${Date.now()}`,
      );
      const src = await cacheStudioFile(assetId, file);
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        const size = await readVideoSize(src);
        updateActive((draft) => ({
          ...draft,
          pack: {
            ...draft.pack,
            assets: {
              ...draft.pack.assets,
              heroMedia: {
                type: "video",
                src,
                assetId,
                fit: "cover",
                position: "center top",
                sourceWidth: size.width,
                sourceHeight: size.height,
              },
            },
          },
        }));
        setMessage("Hero 视频已载入，可直接打开活动页预览");
        return;
      }
      const size = await readImageSize(src);
      updateActive((draft) => ({
        ...draft,
        pack: {
          ...draft.pack,
          assets: {
            ...draft.pack.assets,
            heroMedia: {
              type: "image",
              src,
              assetId,
              fit: "cover",
              position: "center top",
              sourceWidth: size.width,
              sourceHeight: size.height,
            },
          },
        },
      }));
      setMessage(`Hero 图片已载入：${size.width}×${size.height}`);
    } catch {
      setMessage("Hero 素材读取失败");
    }
  }

  async function uploadHeroEndFrame(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const assetId = createStudioAssetId(
        activeDraft.id,
        "hero-end",
        `main-${Date.now()}`,
      );
      const src = await cacheStudioFile(assetId, file);
      const size = await readImageSize(src);
      updateCollectionHeroComposition((composition) => ({
        ...composition,
        finalReference: {
          type: "image",
          src,
          assetId,
          fit: activeDraft.pack.assets.heroMedia.fit ?? "cover",
          position:
            activeDraft.pack.assets.heroMedia.position ?? "center top",
          sourceWidth: size.width,
          sourceHeight: size.height,
        },
      }));
      setMessage(`Hero 尾帧已载入：${size.width}×${size.height}`);
    } catch {
      setMessage("Hero 尾帧读取失败");
    }
  }

  async function uploadCard(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const card = activeDraft.content.cards[index];
      if (!card) throw new Error("卡位不存在");
      const assetId = createStudioAssetId(
        activeDraft.id,
        "card",
        card.id,
      );
      const src = await cacheStudioFile(assetId, file);
      const size = await readImageSize(src);
      updateCard(index, {
        image: src,
        imageAssetId: assetId,
        imageWidth: size.width,
        imageHeight: size.height,
      });
      setMessage(`第 ${index + 1} 张卡片素材已缓存到本机`);
    } catch {
      setMessage(`第 ${index + 1} 张卡片素材读取失败`);
    }
  }

  async function uploadCards(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(
      0,
      activeDraft.content.cards.length,
    );
    event.target.value = "";
    if (files.length === 0) return;
    try {
      const assets = await Promise.all(
        files.map(async (file, index) => {
          const card = activeDraft.content.cards[index];
          if (!card) throw new Error("卡位不存在");
          const assetId = createStudioAssetId(
            activeDraft.id,
            "card",
            card.id,
          );
          const src = await cacheStudioFile(assetId, file);
          const size = await readImageSize(src);
          return { src, assetId, ...size };
        }),
      );
      updateActive((draft) => ({
        ...draft,
        content: {
          ...draft.content,
          cards: draft.content.cards.map((card, index) => ({
            ...card,
            image: assets[index]?.src ?? card.image,
            imageAssetId:
              assets[index]?.assetId ?? card.imageAssetId,
            imageWidth: assets[index]?.width ?? card.imageWidth,
            imageHeight: assets[index]?.height ?? card.imageHeight,
          })),
        },
      }));
      setMessage(
        `已按文件顺序缓存 ${assets.length} 张卡片；刷新后仍会保留`,
      );
    } catch {
      setMessage("批量素材读取失败，请检查图片文件");
    }
  }

  async function uploadTier(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const asset = await readImageAsset(file);
      updateTierAsset(index, {
        image: asset.src,
        imageWidth: asset.width,
        imageHeight: asset.height,
      });
      setMessage(`已替换第 ${index + 1} 档奖励素材`);
    } catch {
      setMessage(`第 ${index + 1} 档奖励素材读取失败`);
    }
  }

  function renderCanvasCandidate(
    group: AiCandidateGroup,
    candidate: AiCandidate,
    slotLabel: string,
  ) {
    const isSelected =
      selectedAiAsset?.groupId === group.id &&
      selectedAiAsset.candidateId === candidate.id;
    const isTrying =
      group.id === aiTrial?.groupId &&
      candidate.id === aiTrial.candidate.id;
    const isAdopted =
      candidate.id === adoptedCandidateId ||
      group.id === adoptedGroupId;
    return (
      <button
        type="button"
        className={[
          "studio-ai-candidate-tile",
          isSelected ? "selected" : "",
          isTrying ? "trying" : "",
          isAdopted ? "adopted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-candidate-kind={
          group.batch ? "m2-batch-asset" : candidate.target?.kind ?? "free"
        }
        aria-label={`引用 ${candidate.label} 到 ${
          candidate.target?.label ?? "Canvas"
        }`}
        title={`${candidate.label} · ${candidate.width} × ${candidate.height}`}
        onClick={(event) => {
          event.stopPropagation();
          if (candidate.target) {
            tryAiCandidate(candidate, group.id, candidate.target);
            return;
          }
          setSelectedAiAsset({
            groupId: group.id,
            candidateId: candidate.id,
          });
        }}
        key={candidate.id}
      >
        <span className="studio-ai-candidate-image">
          <img
            src={candidate.src}
            alt=""
            draggable={false}
            style={{ objectPosition: candidate.position ?? "center" }}
          />
          <i>{slotLabel}</i>
        </span>
      </button>
    );
  }

  return (
    <div
      className="studio-shell"
      data-testid="config-tool"
      data-inspector-open={inspectorOpen}
      data-preview-mode={previewMode}
    >
      <header className="studio-global-nav" aria-label="创作者中心顶部导航">
        <div className="studio-global-brand" aria-hidden="true" />
        <nav className="studio-global-links" aria-label="产品导航">
          {[
            ["首页", "/studio-figma/nav-home.svg"],
            ["AI分身", "/studio-figma/nav-avatar-ai.svg"],
            ["百科", "/studio-figma/nav-book.svg"],
            ["随变", "/studio-figma/nav-create.svg"],
            ["AI工坊", "/studio-figma/nav-workshop.svg"],
          ].map(([label, icon]) => (
            <button
              type="button"
              className={label === "AI工坊" ? "active" : ""}
              key={label}
            >
              <img src={icon} alt="" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="studio-global-account">
          <span className="studio-global-points" aria-label="创作点数 276">
            <img src="/studio-figma/points-star-a.svg" alt="" />
            <b>276</b>
          </span>
          <img src="/studio-figma/avatar.png" alt="用户头像" />
        </div>
      </header>

      <aside
        className="studio-project-nav"
        aria-label="项目导航"
        data-readonly={previewMode}
        inert={previewMode ? true : undefined}
      >
        <button
          type="button"
          className="studio-new-project"
          onClick={duplicateActive}
        >
          <span className="studio-nav-icon" aria-hidden="true">
            <img src="/studio-figma/project-nav/plus.svg" alt="" />
          </span>
          新建项目
        </button>

        <nav className="studio-project-primary" aria-label="资源导航">
          <button type="button">
            <span className="studio-nav-icon" aria-hidden="true">
              <img src="/studio-figma/project-nav/skills.svg" alt="" />
            </span>
            技能库
          </button>
          <button type="button">
            <span className="studio-nav-icon" aria-hidden="true">
              <img src="/studio-figma/project-nav/resources.svg" alt="" />
            </span>
            资源库
          </button>
          <span className="studio-project-nav-divider" aria-hidden="true" />
          <button type="button" className="active">
            <span className="studio-nav-icon" aria-hidden="true">
              <img src="/studio-figma/project-nav/projects.svg" alt="" />
            </span>
            项目库
          </button>
          <span className="studio-project-nav-divider" aria-hidden="true" />
        </nav>

        <div className="studio-project-tree">
          <div className="studio-project-tree-heading">
            <span>项目列表</span>
            <img
              src="/studio-figma/project-nav/search.svg"
              alt=""
              aria-hidden="true"
            />
          </div>
          <button type="button" className="studio-project-tree-item">
            <span className="studio-tree-chevron" aria-hidden="true">
              <img src="/studio-figma/project-nav/chevron-right.svg" alt="" />
            </span>
            塔罗兴趣卡
          </button>
          <button
            type="button"
            className="studio-project-tree-item active"
            onClick={() => {
              setCanvasMode("page");
              setSelectedPageId("campaign-main");
            }}
          >
            <span className="studio-tree-chevron" aria-hidden="true">
              <img src="/studio-figma/project-nav/chevron-right.svg" alt="" />
            </span>
            抖音 ACG 游戏新春会
          </button>
          <div className="studio-project-children">
            <button
              type="button"
              className="active"
              onClick={() => {
                setSelectedPageId("campaign-main");
                setCanvasMode("page");
              }}
            >
              <span className="studio-project-child-icon blue" aria-hidden="true">
                <img src="/studio-figma/project-nav/project-file.svg" alt="" />
              </span>
              项目文件
            </button>
            <button type="button">
              <span className="studio-project-child-icon pink" aria-hidden="true">
                <img src="/studio-figma/project-nav/document.svg" alt="" />
              </span>
              活动文档
            </button>
            <button
              type="button"
              onClick={() => selectAiTarget(null)}
            >
              <span className="studio-project-child-icon purple" aria-hidden="true">
                <img src="/studio-figma/project-nav/assets.svg" alt="" />
              </span>
              素材库
            </button>
            <button type="button">
              <span className="studio-project-child-icon cyan" aria-hidden="true">
                <img src="/studio-figma/project-nav/database.svg" alt="" />
              </span>
              数据库
            </button>
            <button
              type="button"
              onClick={() => {
                setCanvasMode("flow");
                setSelectedAiAsset(null);
              }}
              data-testid="studio-page-flow-entry"
            >
              <span className="studio-project-child-icon green" aria-hidden="true">
                <img src="/studio-figma/project-nav/gameplay.svg" alt="" />
              </span>
              活动玩法配置
            </button>
          </div>
          <button type="button" className="studio-project-tree-item">
            <span className="studio-tree-chevron" aria-hidden="true">
              <img src="/studio-figma/project-nav/chevron-right.svg" alt="" />
            </span>
            射击小游戏
          </button>
        </div>

        <button type="button" className="studio-preferences">
          <span className="studio-nav-icon" aria-hidden="true">
            <img src="/studio-figma/project-nav/settings.svg" alt="" />
          </span>
          偏好设置
        </button>
      </aside>

      <aside className="studio-sidebar studio-library">
        <header className="studio-chat-toolbar">
          <button type="button" className="studio-chat-dropdown">
            <span>抖音 ACG 游戏新春会</span>
            <img src="/studio-figma/chat/chevron-down.svg" alt="" />
          </button>
          <i className="studio-chat-divider" aria-hidden="true" />
          <button type="button" className="studio-chat-dropdown">
            <span>初始创建</span>
            <img src="/studio-figma/chat/chevron-down.svg" alt="" />
          </button>
          <button
            type="button"
            className="studio-chat-new-message"
            aria-label="新建对话"
          >
            <img src="/studio-figma/chat/message-plus.svg" alt="" />
          </button>
          <span className="studio-chat-updated">最近更新时间：12:21</span>
        </header>

        <div
          className="studio-ai-chat"
          data-testid="studio-ai-chat"
          data-panel="chat"
          aria-disabled={previewMode}
          inert={previewMode ? true : undefined}
        >
          <div className="studio-ai-thread" aria-live="polite">
            <div className="studio-ai-message user brief">
              <p>
                帮我做一个抖音 ACG 游戏新春会 H5，聚合热门游戏、
                主会场视频和开年高燃榜单。
              </p>
            </div>
            <div className="studio-ai-message assistant report">
              <p>我来为你生成一个抖音 ACG 游戏新春会 H5</p>
              <p className="studio-ai-elapsed">
                <span>已处理 34s</span>
                <img src="/studio-figma/chat/chevron-right.svg" alt="" />
              </p>
              <p>
                已完成新春主视觉、游戏会场、主视频与高燃榜单集成。
                右侧预览已更新，当前构建状态如下：
              </p>
              <h3>任务总结</h3>
              <ul>
                <li><b>活动类型：</b>ACG 游戏新春会营销 H5</li>
                <li><b>核心主题：</b>好游戏一起过新年</li>
                <li><b>视觉风格：</b>新春红金 + ACG 角色群像</li>
                <li><b>工程文件：</b><code>index.html</code> <code>assets/</code> <code>config/</code> 均已就绪</li>
                <li><b>验证结果：</b>适配、切换与热点跳转检查通过</li>
              </ul>
              <h3>已生成内容</h3>
              <ul>
                <li><b>页面内容：</b>主视觉、游戏会场、主视频与高燃榜单</li>
                <li><b>互动能力：</b>会场切换、榜单互动与活动入口跳转</li>
              </ul>
              <div className="studio-ai-version-card">
                <span>抖音 ACG 游戏新春会 <b>V1</b></span>
                <span>
                  变更 6 文件
                  <button type="button" aria-label="回退版本">
                    <img src="/studio-figma/chat/flip-backward.svg" alt="" />
                  </button>
                </span>
              </div>
              <div className="studio-ai-reactions">
                {[
                  ["复制", "/studio-figma/chat/copy.svg"],
                  ["重新生成", "/studio-figma/chat/refresh.svg"],
                  ["有帮助", "/studio-figma/chat/thumbs-up.svg"],
                  ["没帮助", "/studio-figma/chat/thumbs-down.svg"],
                ].map(([label, icon]) => (
                  <button type="button" aria-label={label} key={label}>
                    <img src={icon} alt="" />
                  </button>
                ))}
              </div>
            </div>
            {lastAiPrompt && (
              <div className="studio-ai-message user">
                <small>你 · {aiTarget?.label ?? "自由素材"}</small>
                <p>{lastAiPrompt}</p>
              </div>
            )}
            {aiStatus === "generating" && (
              <div className="studio-ai-message assistant generating">
                <small>生成任务</small>
                <p>
                  正在读取尺寸、安全区、当前主题与 {aiReferences.length} 张参考图…
                </p>
              </div>
            )}
            {aiStatus === "ready" && (
              <div className="studio-ai-message assistant">
                <small>生成完成</small>
                <p>
                  新素材已打成一组放进 Canvas；点击图片即可引用到 H5
                  预览，整套模块可一次回填。
                </p>
              </div>
            )}
          </div>

          <form
            className="studio-ai-composer"
            data-testid="studio-ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              runAiGeneration();
            }}
          >
            <div className="studio-ai-composer-box">
              <div className="studio-ai-context-row">
                {aiTarget ? (
                  <span
                    className="studio-ai-target-pill"
                    data-testid="studio-ai-target-pill"
                    title={`${aiTarget.displaySize} → ${aiTarget.outputSize} · ${aiTarget.accepts}`}
                  >
                    <b>模块约束</b>
                    {aiTarget.label}
                    <i>{aiTarget.outputSize}</i>
                    <button
                      type="button"
                      onClick={() => selectAiTarget(null)}
                      aria-label="移除生成目标约束"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span
                    className="studio-ai-target-pill free"
                    data-testid="studio-ai-target-pill"
                  >
                    <b>自由素材</b>
                    不自动回填 H5
                  </span>
                )}
              </div>

              {aiReferences.length > 0 && (
                <div
                  className="studio-ai-reference-list"
                  data-testid="studio-ai-reference-list"
                >
                  {aiReferences.map((reference) => (
                    <span key={reference.id}>
                      <img src={reference.src} alt="" />
                      <small>{reference.name}</small>
                      <button
                        type="button"
                        onClick={() => removeAiReference(reference.id)}
                        aria-label={`移除参考图 ${reference.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <label className="studio-sr-only" htmlFor="studio-ai-prompt">
                描述你想要的素材
              </label>
              <textarea
                id="studio-ai-prompt"
                ref={aiPromptRef}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="继续调整当前活动 H5..."
                rows={4}
                data-testid="studio-ai-prompt"
              />

              <div className="studio-ai-composer-actions">
                <label className="studio-ai-reference-button">
                  <span className="studio-composer-plus" aria-hidden="true">
                    <img src="/studio-figma/chat/plus.svg" alt="" />
                  </span>
                  <span className="studio-composer-extension">
                    <img src="/studio-figma/chat/folder-code.svg" alt="" />
                    扩展
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAiReferenceUpload}
                    data-testid="studio-ai-reference-input"
                  />
                </label>
                <small>
                  Auto
                  <img src="/studio-figma/chat/auto-chevron.svg" alt="" />
                </small>
                <button
                  type="submit"
                  disabled={aiStatus === "generating"}
                  data-testid="studio-ai-generate"
                  aria-label={
                    aiStatus === "generating"
                      ? "正在生成候选"
                      : "开始生成候选"
                  }
                >
                  {aiStatus === "generating" ? (
                    "···"
                  ) : (
                    <img src="/studio-figma/chat/send.svg" alt="" />
                  )}
                </button>
              </div>
            </div>
            <small className="studio-ai-composer-footnote">
              支持添加参考图；生成结果会作为素材组进入 Canvas。
            </small>
          </form>
        </div>
      </aside>

      <section className="studio-canvas">
        <header className="studio-toolbar">
          <div className="studio-canvas-tabs" role="tablist" aria-label="打开的画布">
            <button type="button" role="tab" aria-selected="true">
              <img src="/studio-figma/canvas/preview.svg" alt="" />
              <span>预览</span>
            </button>
            <button type="button" aria-label="新建画布">
              <img src="/studio-figma/canvas/plus-tab.svg" alt="" />
            </button>
          </div>
        </header>

        <div className="studio-canvas-subtoolbar">
          <strong>
            {canvasMode === "flow" ? "页面流程" : "游戏新春会首页"}
          </strong>
          <div>
            <button type="button" onClick={resetActive} aria-label="恢复默认">
              <img src="/studio-figma/canvas/reset.svg" alt="" />
            </button>
            <button
              type="button"
              className={canvasMode === "page" ? "active" : ""}
              onClick={() => setCanvasMode("page")}
            >
              <img src="/studio-figma/canvas/edit.svg" alt="" />
              画布编辑
            </button>
          </div>
        </div>

        <div
          className="studio-preview-world"
          ref={previewWorldRef}
          data-testid="studio-canvas-surface"
          data-space-held={spaceHeld}
          onWheel={handleCanvasWheel}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
          onPointerCancel={handleCanvasPointerEnd}
        >
          {selectedCandidate && (
            <div
              className="studio-asset-quickbar"
              data-testid="studio-asset-quickbar"
              role="toolbar"
              aria-label="所选素材快捷工具"
            >
              <span>
                <small>图片素材</small>
                <strong>{selectedCandidate.label}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  tryAiCandidate(
                    selectedCandidate,
                    selectedCandidateGroup?.id ?? "",
                    selectedCandidate.target
                      ? undefined
                      : aiTarget ?? createHeroAiTarget(activeDraft),
                  )
                }
              >
                {aiTrial?.candidate.id === selectedCandidate.id
                  ? "已引用预览"
                  : selectedCandidate.target
                    ? "引用到 H5"
                    : "绑定到 H5"}
              </button>
              <button
                type="button"
                onClick={() =>
                  selectAiTarget(
                    selectedCandidateGroup?.target ??
                      selectedCandidate.target ??
                      createHeroAiTarget(activeDraft),
                  )
                }
              >
                继续生成
              </button>
              <button
                type="button"
                onClick={() => setSelectedAiAsset(null)}
              >
                关闭工具
              </button>
            </div>
          )}

          <div
            className="studio-canvas-controls"
            role="group"
            aria-label="画布缩放控制"
          >
            <button
              type="button"
              data-testid="studio-canvas-zoom-out"
              onClick={() => adjustCanvasZoom(-0.05)}
              disabled={canvasZoom <= CANVAS_MIN_ZOOM}
            >
              <img src="/studio-figma/canvas/minus.svg" alt="" />
            </button>
            <output data-testid="studio-canvas-zoom">
              {Math.round(canvasZoom * 100)}%
            </output>
            <button
              type="button"
              data-testid="studio-canvas-zoom-in"
              onClick={() => adjustCanvasZoom(0.05)}
              disabled={canvasZoom >= CANVAS_MAX_ZOOM}
            >
              <img src="/studio-figma/canvas/plus.svg" alt="" />
            </button>
          </div>
          {aiTrial && (
            <div
              className="studio-ai-trial-bar"
              data-testid="studio-ai-trial-bar"
            >
              <span>
                <small>正在试用</small>
                <strong>
                  {aiTrial.candidate.label} → {aiTrial.target.label}
                </strong>
              </span>
              <button type="button" onClick={cancelAiTrial}>
                退出试用
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirmAiTrial}
              >
                确认到草稿
              </button>
            </div>
          )}
          <p className="studio-canvas-help">
            按住空格拖动画布 · 在手机内滚动浏览 H5 · Ctrl/⌘ + 滚轮缩放
          </p>
          <div
            className="studio-canvas-pan-layer"
            style={{
              transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0)`,
            }}
          >
            <div
              className="studio-canvas-scene"
              ref={canvasSceneRef}
              data-testid="studio-canvas-root"
              data-canvas-zoom={canvasZoom.toFixed(2)}
              style={
                {
                  "--studio-canvas-scale": canvasZoom,
                } as CSSProperties
              }
            >
            <div
              className="studio-ai-candidate-groups"
              data-testid="studio-ai-candidate-groups"
              hidden={canvasMode !== "page" || aiCandidateGroups.length === 0}
              aria-label="Canvas 中的 AI 素材组"
            >
              {aiCandidateGroups.map((group, groupIndex) => (
                <section
                  className={`studio-ai-candidate-group ${
                    group.collapsed ? "collapsed" : ""
                  }`}
                  data-candidate-group-id={group.id}
                  data-target-kind={group.target?.kind ?? "free"}
                  data-card-count={group.batch?.cardCount}
                  data-reward-count={group.batch?.rewardCount}
                  style={{
                    transform: `translate3d(${group.position.x}px, ${group.position.y}px, 0)`,
                    zIndex: 4 + groupIndex,
                  }}
                  key={group.id}
                >
                  <header>
                    <div
                      className="studio-ai-candidate-drag-handle"
                      onPointerDown={(event) =>
                        handleCandidateGroupPointerDown(event, group)
                      }
                      onPointerMove={handleCandidateGroupPointerMove}
                      onPointerUp={handleCandidateGroupPointerEnd}
                      onPointerCancel={handleCandidateGroupPointerEnd}
                      title="拖动素材组"
                    >
                      <i aria-hidden="true">⠿</i>
                      <span>
                        <small>AI 素材组 · {group.pageId}</small>
                        <strong>
                          {group.target?.label ?? "自由生成"} ·{" "}
                          {group.batch
                            ? `1 套（${group.batch.cardCount} 卡 + ${group.batch.rewardCount} 奖励）`
                            : `${group.candidates.length} 个候选`}
                        </strong>
                      </span>
                    </div>
                    <div className="studio-ai-candidate-group-actions">
                      {group.batch && (
                        <button
                          type="button"
                          className="primary"
                          onClick={() => applyAiCandidateGroup(group)}
                          data-testid="studio-apply-m2-batch"
                        >
                          {adoptedGroupId === group.id
                            ? "已整组引用"
                            : "整组引用到 H5"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCandidateGroup(group.id)}
                        aria-expanded={!group.collapsed}
                      >
                        {group.collapsed ? "展开" : "收起"}
                      </button>
                    </div>
                  </header>

                  {!group.collapsed &&
                    (group.batch ? (
                      <div
                        className="studio-ai-batch-layout"
                        data-candidate-kind="m2-batch"
                      >
                        <section className="studio-ai-batch-section cards">
                          <header>
                            <span>
                              卡片素材 <b>9/9</b>
                            </span>
                            <small>180 × 220 px · 透明底</small>
                          </header>
                          <div className="studio-ai-candidate-grid studio-ai-card-batch-grid">
                            {group.candidates
                              .filter(
                                (candidate) =>
                                  candidate.target?.kind === "card",
                              )
                              .map((candidate, index) =>
                                renderCanvasCandidate(
                                  group,
                                  candidate,
                                  `C${index + 1}`,
                                ),
                              )}
                          </div>
                        </section>
                        <section className="studio-ai-batch-section rewards">
                          <header>
                            <span>
                              奖励素材 <b>4/4</b>
                            </span>
                            <small>券 140 × 82 · 大奖 132 × 90</small>
                          </header>
                          <div className="studio-ai-candidate-grid studio-ai-reward-batch-grid">
                            {group.candidates
                              .filter(
                                (candidate) =>
                                  candidate.target?.kind === "reward",
                              )
                              .map((candidate, index) =>
                                renderCanvasCandidate(
                                  group,
                                  candidate,
                                  `R${index + 1}`,
                                ),
                              )}
                          </div>
                        </section>
                      </div>
                    ) : (
                      <div
                        className="studio-ai-candidate-grid studio-ai-hero-candidate-grid"
                        data-candidate-kind="hero"
                      >
                        {group.candidates.map((candidate, index) =>
                          renderCanvasCandidate(
                            group,
                            candidate,
                            `0${index + 1}`,
                          ),
                        )}
                      </div>
                    ))}
                </section>
              ))}
            </div>

            <div
              className="studio-phone-stage"
              data-testid="studio-phone-stage"
              data-canvas-zoom={canvasZoom.toFixed(2)}
              data-h5-mode={h5EditMode ? "edit" : "preview"}
              hidden={canvasMode !== "page"}
            >
              {h5EditMode && selectedPageId === "campaign-main" && (
                <nav
                  className="studio-h5-target-toolbar"
                  aria-label="H5 可生成目标"
                >
                  <span>H5 编辑态</span>
                  <button
                    type="button"
                    className={
                      aiTarget?.slotId === "m1.hero-media"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectAiTarget(createHeroAiTarget(activeDraft))
                    }
                  >
                    M1 Hero
                  </button>
                  <button
                    type="button"
                    className={
                      aiTarget?.kind === "collection-kit" ? "active" : ""
                    }
                    onClick={() =>
                      selectAiTarget(
                        createCollectionKitAiTarget(activeDraft),
                      )
                    }
                  >
                    M2 整套 9+4
                  </button>
                </nav>
              )}
              <div className="studio-phone-label">
                <span>
                  {selectedPage.order} · {selectedPage.name} · 375 × 875 px · 9:21
                </span>
                <b>
                  {selectedPage.kind === "overlay"
                    ? "浮层"
                    : selectedPage.status === "ready"
                      ? "已配置"
                      : "待搭建"}
                </b>
              </div>
              <div
                className="studio-phone"
                ref={phoneViewportRef}
                data-testid="config-preview"
                data-preview-ratio="9:21"
                onClickCapture={(event) => {
                  if (!h5EditMode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedAiAsset(null);
                  setMessage(
                    selectedPageId === "campaign-main"
                      ? "H5 已进入编辑态；请选择上方 M1/M2 目标或使用右侧模块配置"
                      : `已选中「${selectedPage.name}」页面画布`,
                  );
                }}
              >
                {selectedPageId === "campaign-main" ? (
                  <CampaignExperience
                    key={`${activeDraft.id}:${
                      previewMode ? `preview-${previewSessionId}` : "edit"
                    }`}
                    configuration={runtimeConfiguration}
                    initialTheme={activeDraft.baseTheme}
                    persistProgress={false}
                    fixture={!previewMode}
                    studioPreview={previewMode}
                    heroLayerPreviewCardIds={
                      previewMode ? undefined : h5HeroLayerPreviewCardIds
                    }
                  />
                ) : (
                  <div
                    className={`studio-page-placeholder ${selectedPage.template}`}
                    data-testid="studio-page-placeholder"
                  >
                    <div className="studio-page-placeholder-map" />
                    <div className="studio-page-placeholder-content">
                      <small>{selectedPage.route}</small>
                      <b>{selectedPage.name}</b>
                      {selectedPage.template === "loading" && (
                        <>
                          <span className="studio-page-loader" />
                          <p>资源加载完成后自动进入角色选择</p>
                        </>
                      )}
                      {selectedPage.template === "character-select" && (
                        <>
                          <p>选择与你同行的夏日角色</p>
                          <div className="studio-character-options">
                            <i>🐴</i>
                            <i>🦀</i>
                            <i>🦈</i>
                          </div>
                          <button type="button">确认角色</button>
                        </>
                      )}
                      {selectedPage.id === "prizes" && (
                        <>
                          <p>奖券与实物奖励列表</p>
                          <div className="studio-placeholder-list">
                            <i />
                            <i />
                            <i />
                          </div>
                        </>
                      )}
                      {selectedPage.id === "rules" && (
                        <>
                          <p>以 overlay 方式覆盖当前页面，并保留返回路径。</p>
                          <div className="studio-placeholder-copy" />
                        </>
                      )}
                      <span className="studio-page-placeholder-note">
                        页面模板已进入项目；内容模块可继续配置
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="studio-page-flow-stage"
              hidden={canvasMode !== "flow"}
              data-testid="studio-page-flow-canvas"
            >
              <header>
                <span>
                  <small>Campaign flow</small>
                  <strong>页面与跳转</strong>
                </span>
                <b>1 个起始页 · 5 个页面 · 4 条边</b>
              </header>

              <div className="studio-flow-trunk">
                {CAMPAIGN_PAGES.slice(0, 3).map((page, index) => {
                  const edge = flowEdges.find(
                    (item) => item.fromPageId === page.id,
                  );
                  return (
                    <div className="studio-flow-step" key={page.id}>
                      <button
                        type="button"
                        className={
                          selectedPageId === page.id ? "active" : ""
                        }
                        onClick={() => setSelectedPageId(page.id)}
                        onDoubleClick={() => {
                          setSelectedPageId(page.id);
                          setCanvasMode("page");
                        }}
                      >
                        <span className={`studio-flow-thumb ${page.template}`}>
                          {page.id === "campaign-main" ? (
                            <img
                              src={activeDraft.pack.assets.heroMedia.src}
                              alt=""
                            />
                          ) : (
                            <i aria-hidden="true">
                              {page.template === "loading" ? "···" : "角色"}
                            </i>
                          )}
                        </span>
                        <span>
                          <small>
                            {page.order} · {page.kind}
                          </small>
                          <strong>{page.name}</strong>
                          <i>{page.route}</i>
                        </span>
                      </button>
                      {index < 2 && edge && (
                        <span className="studio-flow-edge">
                          <small>{edge.eventKey}</small>
                          <b>{edge.navigation} →</b>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="studio-flow-branches">
                <span className="studio-flow-branch-origin">
                  <b>活动主页事件</b>
                  <small>组件只暴露稳定 eventKey，不绑定 CSS selector</small>
                </span>
                {CAMPAIGN_PAGES.slice(3).map((page) => {
                  const edge = flowEdges.find(
                    (item) => item.targetPageId === page.id,
                  );
                  return (
                    <button
                      type="button"
                      className={selectedPageId === page.id ? "active" : ""}
                      onClick={() => setSelectedPageId(page.id)}
                      onDoubleClick={() => {
                        setSelectedPageId(page.id);
                        setCanvasMode("page");
                      }}
                      key={page.id}
                    >
                      <span>
                        <small>
                          {edge?.eventKey} · {edge?.navigation}
                        </small>
                        <strong>{page.name}</strong>
                      </span>
                      <b>{edge?.transition}</b>
                    </button>
                  );
                })}
              </div>

              <footer>
                单击选择页面与跳转配置 · 双击进入该页面画布
              </footer>
            </div>
            </div>
          </div>
        </div>

        <footer className="studio-status" role="status">
          <span>{message}</span>
          <div className="studio-status-actions">
            {lastAiCommit?.draftId === activeDraft.id && (
              <button type="button" onClick={undoLastAiCommit}>
                撤销 AI 确认
              </button>
            )}
          </div>
        </footer>
      </section>

      {inspectorOpen && (
      <aside
        className="studio-sidebar studio-inspector"
        data-readonly={previewMode}
      >
        <div className="studio-inspector-workbar">
          <button type="button" aria-label="帮助与支持">
            <img src="/studio-figma/canvas/headset.svg" alt="" />
          </button>
          <button
            type="button"
            className={previewMode ? "active" : ""}
            onClick={previewMode ? exitActivityPreview : openActivityPreview}
            data-testid="studio-h5-edit-toggle"
          >
            {previewMode ? "退出预览" : "预览"}
          </button>
          <button type="button" className="publish" onClick={applyActive}>
            发布
          </button>
        </div>
        <header className="studio-inspector-header">
          <div>
            <small>正在编辑</small>
            <strong>{activeDraft.name}</strong>
          </div>
          <span
            className={validationIssues.length > 0 ? "warning" : ""}
            title={validationIssues.join("；")}
          >
            {validationIssues.length > 0
              ? `${validationIssues.length} 项待检查`
              : "配置完整"}
          </span>
        </header>

        <div
          className="studio-inspector-group studio-project-group"
          data-testid="inspector-group-project"
        >
          <div className="studio-inspector-group-title">
            <span>Project</span>
            <strong>页面与方案</strong>
          </div>

          <details open data-setting-id="pages">
            <SectionSummary index="P1">页面与跳转</SectionSummary>
            <div className="studio-section-body">
              <div className="studio-project-summary">
                <span>
                  <strong>5 个页面</strong>
                  <small>1 个起始页 · 1 个 overlay</small>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCanvasMode("flow");
                    setSelectedAiAsset(null);
                  }}
                  data-testid="studio-project-open-flow"
                >
                  在 Canvas 查看流程
                </button>
              </div>

              <div
                className="studio-project-pages"
                data-testid="studio-project-pages"
              >
                {CAMPAIGN_PAGES.map((page) => (
                  <button
                    type="button"
                    className={
                      selectedPageId === page.id ? "active" : ""
                    }
                    onClick={() => {
                      setSelectedPageId(page.id);
                      setCanvasMode("page");
                      setSelectedAiAsset(null);
                    }}
                    key={page.id}
                  >
                    <span>{page.order}</span>
                    <i
                      className={`studio-page-kind ${page.kind}`}
                      aria-hidden="true"
                    />
                    <b>{page.name}</b>
                    <small>
                      {page.id === "loading"
                        ? "Start"
                        : page.kind === "overlay"
                          ? "Overlay"
                          : page.status === "ready"
                            ? "Ready"
                            : "Draft"}
                    </small>
                  </button>
                ))}
              </div>

              <details className="studio-subdetails">
                <summary>跳转事件与动作</summary>
                <div
                  className="studio-flow-edge-editor"
                  data-testid="studio-flow-edge-editor"
                >
                  {flowEdges.map((edge) => {
                    const fromPage = CAMPAIGN_PAGES.find(
                      (page) => page.id === edge.fromPageId,
                    );
                    return (
                      <article key={edge.id}>
                        <span>
                          <small>{fromPage?.name}</small>
                          <input
                            type="text"
                            value={edge.eventKey}
                            onChange={(event) =>
                              updateFlowEdge(edge.id, {
                                eventKey: event.target.value,
                              })
                            }
                            aria-label={`${fromPage?.name}触发事件`}
                          />
                        </span>
                        <select
                          value={edge.navigation}
                          onChange={(event) =>
                            updateFlowEdge(edge.id, {
                              navigation: event.target
                                .value as CampaignFlowEdge["navigation"],
                            })
                          }
                          aria-label={`${fromPage?.name}导航方式`}
                        >
                          <option value="push">push</option>
                          <option value="replace">replace</option>
                          <option value="overlay">overlay</option>
                          <option value="back">back</option>
                        </select>
                        <select
                          value={edge.targetPageId}
                          onChange={(event) =>
                            updateFlowEdge(edge.id, {
                              targetPageId: event.target.value,
                            })
                          }
                          aria-label={`${fromPage?.name}目标页面`}
                        >
                          {CAMPAIGN_PAGES.map((page) => (
                            <option value={page.id} key={page.id}>
                              → {page.name}
                            </option>
                          ))}
                        </select>
                      </article>
                    );
                  })}
                </div>
              </details>
            </div>
          </details>

          <details open data-setting-id="schemes">
            <SectionSummary index="P2">多主题方案</SectionSummary>
            <div
              className="studio-section-body studio-scheme-panel"
              data-testid="studio-scheme-panel"
            >
              <div className="studio-inspector-create-row">
                <button
                  type="button"
                  onClick={() => addFromTheme("summer")}
                >
                  新建夏日方案
                </button>
                <button
                  type="button"
                  onClick={() => addFromTheme("night")}
                >
                  新建夜食方案
                </button>
              </div>

              <div className="studio-inspector-scheme-list" aria-label="主题方案">
                {drafts.map((draft) => (
                  <button
                    type="button"
                    className={
                      draft.id === activeDraft.id ? "active" : ""
                    }
                    onClick={() => setActiveId(draft.id)}
                    key={draft.id}
                  >
                    <i
                      style={{ background: draft.pack.colors.accent }}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{draft.name}</strong>
                      <small>
                        {draft.baseTheme === "summer"
                          ? "夏日模板"
                          : "夜食模板"}
                      </small>
                    </span>
                    <b>{draft.id === activeDraft.id ? "当前" : "切换"}</b>
                  </button>
                ))}
              </div>

              <div className="studio-inspector-scheme-actions">
                <button type="button" onClick={duplicateActive}>
                  复制
                </button>
                <label className="studio-file-button">
                  导入 JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={importDraft}
                    data-testid="config-import-input"
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  onClick={deleteActive}
                  disabled={drafts.length <= 1}
                >
                  删除
                </button>
              </div>
              {importError && (
                <p className="studio-error" data-testid="config-error">
                  导入失败：{importError}
                </p>
              )}
            </div>
          </details>
        </div>

        <div
          className="studio-inspector-group"
          data-testid="inspector-group-global"
        >
          <div className="studio-inspector-group-title">
            <span>Global</span>
            <strong>全局设置</strong>
          </div>
        <details open data-setting-id="theme">
          <SectionSummary index="G1">主题基础</SectionSummary>
          <div className="studio-section-body">
            <Field label="方案名称">
              <input
                type="text"
                value={activeDraft.name}
                onChange={(event) =>
                  updateActive((draft) => ({
                    ...draft,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="主题 Tab 文案" hint="建议不超过 8 个汉字">
              <input
                type="text"
                value={activeDraft.content.navLabel}
                onChange={(event) =>
                  updateContent({ navLabel: event.target.value })
                }
                data-testid="config-field-title"
              />
            </Field>
            <Field label="无障碍标题">
              <input
                type="text"
                value={activeDraft.content.accessibleTitle}
                onChange={(event) =>
                  updateContent({ accessibleTitle: event.target.value })
                }
              />
            </Field>
          </div>
        </details>

        <details open data-setting-id="brand">
          <SectionSummary index="G2">品牌配色</SectionSummary>
          <div className="studio-section-body">
            <p className="studio-section-note">
              全局语义色会联动多个模块；模块内的局部素材仍在对应模块中配置。
            </p>
            <div className="studio-color-grid">
              {CORE_COLOR_FIELDS.map((field) => (
                <ColorField
                  label={field.label}
                  value={activeDraft.pack.colors[field.key]}
                  onChange={(value) =>
                    updatePackColor(field.key, value)
                  }
                  key={field.key}
                />
              ))}
            </div>
            <details className="studio-subdetails">
              <summary>高级颜色 token</summary>
              <div className="studio-color-grid">
                {ADVANCED_COLOR_FIELDS.map((field) => (
                  <ColorField
                    label={field.label}
                    value={activeDraft.pack.colors[field.key]}
                    onChange={(value) =>
                      updatePackColor(field.key, value)
                    }
                    key={field.key}
                  />
                ))}
              </div>
            </details>
          </div>
        </details>
        </div>

        <div
          className="studio-inspector-group"
          data-testid="inspector-group-modules"
        >
          <div className="studio-inspector-group-title">
            <span>Modules</span>
            <strong>页面模块</strong>
          </div>
        <details open data-module-id="hero">
          <SectionSummary index="M1">首焦与主操作</SectionSummary>
          <div className="studio-section-body">
            <div className="studio-hero-source-actions">
              <button
                type="button"
                className="studio-ai-slot-action"
                onClick={() =>
                  selectAiTarget(createHeroAiTarget(activeDraft))
                }
                data-testid="studio-ai-target-hero"
              >
                <span>AI 生成</span>
                <small>375 × 500 · 自带当前主题约束</small>
              </button>
            </div>
            <div
              className="studio-hero-frame-grid"
              data-testid="config-hero-frame-slots"
            >
              <label className="studio-hero-frame-card">
                <span className="studio-hero-frame-preview">
                  {activeDraft.pack.assets.heroMedia.type === "video" ? (
                    <video
                      src={activeDraft.pack.assets.heroMedia.src}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={activeDraft.pack.assets.heroMedia.src}
                      alt="Hero 首帧预览"
                    />
                  )}
                </span>
                <span>
                  <strong>首帧</strong>
                  <small>进入活动与抽卡前显示</small>
                  <b>上传图片</b>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadHero}
                  data-testid="config-hero-start-frame-upload"
                />
              </label>
              <label className="studio-hero-frame-card">
                <span className="studio-hero-frame-preview">
                  {collectionHeroComposition?.finalReference?.src ? (
                    <img
                      src={collectionHeroComposition.finalReference.src}
                      alt="Hero 尾帧预览"
                    />
                  ) : (
                    <i>待上传</i>
                  )}
                </span>
                <span>
                  <strong>尾帧</strong>
                  <small>两段过场播放完成后停留</small>
                  <b>上传图片</b>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadHeroEndFrame}
                  disabled={!collectionHeroComposition}
                  data-testid="config-hero-end-frame-upload"
                />
              </label>
            </div>
            <Field label="首帧素材地址">
              <input
                type="text"
                value={activeDraft.pack.assets.heroMedia.src}
                onChange={(event) =>
                  updateActive((draft) => ({
                    ...draft,
                    pack: {
                      ...draft.pack,
                      assets: {
                        ...draft.pack.assets,
                        heroMedia: {
                          ...draft.pack.assets.heroMedia,
                          src: event.target.value,
                        },
                      },
                    },
                  }))
                }
                data-testid="config-field-hero-media"
              />
            </Field>
            {collectionHeroComposition && (
              <Field label="尾帧素材地址">
                <input
                  type="text"
                  value={
                    collectionHeroComposition.finalReference?.src ?? ""
                  }
                  onChange={(event) =>
                    updateCollectionHeroComposition((composition) => ({
                      ...composition,
                      finalReference: event.target.value
                        ? {
                            type: "image",
                            src: event.target.value,
                            fit:
                              composition.finalReference?.fit ?? "cover",
                            position:
                              composition.finalReference?.position ??
                              "center top",
                          }
                        : undefined,
                    }))
                  }
                  data-testid="config-field-hero-end-frame"
                />
              </Field>
            )}
            <div className="studio-two-fields">
              <Field label="填充方式">
                <select
                  value={activeDraft.pack.assets.heroMedia.fit ?? "cover"}
                  onChange={(event) =>
                    updateActive((draft) => ({
                      ...draft,
                      pack: {
                        ...draft.pack,
                        assets: {
                          ...draft.pack.assets,
                          heroMedia: {
                            ...draft.pack.assets.heroMedia,
                            fit: event.target.value as "cover" | "contain",
                          },
                        },
                      },
                    }))
                  }
                >
                  <option value="cover">铺满裁切</option>
                  <option value="contain">完整展示</option>
                </select>
              </Field>
              <Field label="焦点">
                <select
                  value={
                    activeDraft.pack.assets.heroMedia.position ??
                    "center top"
                  }
                  onChange={(event) =>
                    updateActive((draft) => ({
                      ...draft,
                      pack: {
                        ...draft.pack,
                        assets: {
                          ...draft.pack.assets,
                          heroMedia: {
                            ...draft.pack.assets.heroMedia,
                            position: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                >
                  <option value="center top">顶部居中</option>
                  <option value="center center">中心</option>
                  <option value="left top">左上</option>
                  <option value="right top">右上</option>
                  <option value="center bottom">底部居中</option>
                </select>
              </Field>
            </div>
            <Field label="主按钮文案" hint="建议不超过 10 个汉字">
              <input
                type="text"
                value={activeDraft.content.drawCta}
                onChange={(event) =>
                  updateContent({ drawCta: event.target.value })
                }
              />
            </Field>
            <Field label="左侧入口单位">
              <input
                type="text"
                value={activeDraft.content.collectionEntryLabel}
                onChange={(event) =>
                  updateContent({
                    collectionEntryLabel: event.target.value,
                  })
                }
              />
            </Field>
            <details className="studio-subdetails">
              <summary>首焦模块高级素材</summary>
              <div className="studio-subsection-body">
                <Field
                  label="地图背景图"
                  hint="展示容器 375 × 78 px；建议导出 1125 × 234 px。"
                >
                  <input
                    type="text"
                    value={
                      activeDraft.pack.assets.mapBackgroundImage ?? ""
                    }
                    onChange={(event) =>
                      updatePackAsset(
                        "mapBackgroundImage",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field
                  label="主按钮皮肤"
                  hint="展示容器约 207 × 46 px；建议透明图 621 × 138 px。"
                >
                  <input
                    type="text"
                    value={activeDraft.pack.assets.actionButtonImage ?? ""}
                    onChange={(event) =>
                      updatePackAsset(
                        "actionButtonImage",
                        event.target.value,
                      )
                    }
                  />
                </Field>
              </div>
            </details>
          </div>
        </details>

        <details data-module-id="collection">
          <SectionSummary index="M2">集卡与奖励</SectionSummary>
          <div className="studio-section-body">
            <p className="studio-section-note">
              当前主题包含 {activeDraft.content.cards.length} 张卡片和 {activeDraft.content.tiers.length} 档奖励；稳定 ID 不随换肤改变。
            </p>
            {collectionHeroComposition && (
              <section
                className="studio-hero-layer-editor"
                data-testid="config-hero-layer-editor"
                aria-label="Hero 道具图层"
              >
                <div className="studio-hero-layer-heading">
                  <div>
                    <strong>Hero 道具图层</strong>
                    <span>
                      已配置 {configuredHeroLayerCount}/
                      {heroLayers.length} 个道具
                    </span>
                  </div>
                  <label className="studio-toggle">
                    <input
                      type="checkbox"
                      checked={collectionHeroComposition.enabled}
                      onChange={(event) =>
                        updateCollectionHeroComposition(
                          (composition) => ({
                            ...composition,
                            enabled: event.target.checked,
                          }),
                        )
                      }
                      data-testid="config-hero-layers-enabled"
                    />
                    <i aria-hidden="true" />
                    <span>
                      {collectionHeroComposition.enabled
                        ? "已启用"
                        : "已停用"}
                    </span>
                  </label>
                </div>
                <p className="studio-hero-layer-note">
                  组合画布常显所有已配置图层；选择卡片只切换编辑焦点，不会隐藏其他素材。
                </p>
                <HeroLayerComposer
                  baseMedia={
                    collectionHeroComposition.finalReference ??
                    activeDraft.pack.assets.heroMedia
                  }
                  layers={heroLayers}
                  selectedLayerId={selectedHeroLayer?.id ?? ""}
                  onSelect={(layerId) => setHeroLayerEditId(layerId)}
                  onCommit={updateHeroLayer}
                />
                <div className="studio-hero-layer-canvas-hint">
                  画布以 Hero 尾帧为背景，并始终显示全部已放置素材。点击或拖动图层切换编辑对象，拖右下角控制点等比缩放；坐标按
                  375 × 500 可见区保存。
                </div>
                <div className="studio-hero-layer-list-heading">
                  <strong>{heroLayers.length} 个道具素材</strong>
                  <span>点选后在上方组合画布中定位</span>
                </div>
                <div
                  className="studio-hero-layer-cards"
                  role="tablist"
                  aria-label="选择要定位的道具图层"
                >
                  {heroLayers.map((layer) => {
                    const card = activeDraft.content.cards.find(
                      (item) => item.id === layer.cardId,
                    );
                    const selected = selectedHeroLayer?.id === layer.id;
                    return (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={`${selected ? "selected" : ""} ${
                          layer.presentation === "none" ||
                          layer.transitionMedia?.src ||
                          layer.media?.src ||
                          layer.embeddedInBase
                            ? "configured"
                            : "missing"
                        }`}
                        onClick={() => setHeroLayerEditId(layer.id)}
                        data-testid={`config-hero-layer-${layer.cardId}`}
                        key={layer.id}
                      >
                        <i style={{ background: card?.accent }}>
                          {layer.media?.src ? (
                            <img src={layer.media.src} alt="" />
                          ) : card?.image ? (
                            <img src={card.image} alt="" />
                          ) : (
                            <span>{card?.emoji ?? "?"}</span>
                          )}
                        </i>
                        <b>{card?.name ?? layer.label}</b>
                        <small>
                          {layer.presentation === "video-transition"
                            ? layer.transitionMedia?.src
                              ? "视频过场"
                              : "待上传视频"
                            : layer.presentation === "none"
                              ? "不呈现"
                              : layer.embeddedInBase
                                ? "底图已含"
                                : layer.media?.src
                                  ? "独立图层"
                                  : "待上传"}
                        </small>
                      </button>
                    );
                  })}
                </div>
                {selectedHeroLayer && (
                  <div className="studio-hero-layer-properties">
                    <div className="studio-hero-layer-selected">
                      <div>
                        <strong>{selectedHeroLayer.label}</strong>
                        <span>
                          稳定卡片 ID：{" "}
                          <code>{selectedHeroLayer.cardId}</code>
                        </span>
                      </div>
                      <span className="studio-hero-layer-effect-badge">
                        {(selectedHeroLayer.presentation ??
                          "image-layer") === "image-layer"
                          ? "图片叠加"
                          : selectedHeroLayer.presentation ===
                              "video-transition"
                            ? "视频过场"
                            : "不呈现"}
                      </span>
                    </div>
                    <div className="studio-two-fields">
                      <Field label="获得方式">
                        <select
                          value={
                            selectedHeroLayer.unlockMethod ??
                            (collectionHeroComposition.initialUnlockedCardIds.includes(
                              selectedHeroLayer.cardId,
                            )
                              ? "first-gift"
                              : "draw")
                          }
                          onChange={(event) =>
                            updateHeroLayerUnlockMethod(
                              selectedHeroLayer,
                              event.target.value as NonNullable<
                                CampaignCollectionHeroLayer["unlockMethod"]
                              >,
                            )
                          }
                          data-testid="config-hero-unlock-method"
                        >
                          <option value="first-gift">首次赠送</option>
                          <option value="draw">抽中本卡</option>
                          <option value="points">积分获得</option>
                        </select>
                      </Field>
                      <Field label="点亮后效果">
                        <select
                          value={
                            selectedHeroLayer.presentation ??
                            "image-layer"
                          }
                          onChange={(event) =>
                            updateHeroLayerPresentation(
                              selectedHeroLayer,
                              event.target.value as NonNullable<
                                CampaignCollectionHeroLayer["presentation"]
                              >,
                            )
                          }
                          data-testid="config-hero-presentation"
                        >
                          <option value="image-layer">
                            图片叠加到 Hero
                          </option>
                          <option value="video-transition">
                            播放视频过场
                          </option>
                          <option value="none">仅点亮卡片</option>
                        </select>
                      </Field>
                    </div>
                    {(selectedHeroLayer.unlockMethod ??
                      (collectionHeroComposition.initialUnlockedCardIds.includes(
                        selectedHeroLayer.cardId,
                      )
                        ? "first-gift"
                        : "draw")) === "points" && (
                      <Field
                        label="所需积分"
                        hint="达到积分后发放本卡，并执行下方点亮效果。"
                      >
                        <input
                          type="number"
                          min="1"
                          value={selectedHeroLayer.pointsCost ?? 100}
                          onChange={(event) =>
                            updateHeroLayer(selectedHeroLayer.id, {
                              pointsCost: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            })
                          }
                        />
                      </Field>
                    )}
                    {(selectedHeroLayer.presentation ??
                      "image-layer") !== "none" && (
                      <>
                        <div
                          className="studio-hero-layer-asset-choices"
                          data-testid="config-hero-layer-asset-choices"
                        >
                          <label className="studio-hero-layer-asset-choice">
                            <span className="studio-hero-layer-asset-thumb">
                              {selectedHeroCard?.image ? (
                                <img
                                  src={selectedHeroCard.image}
                                  alt="卡片素材预览"
                                />
                              ) : (
                                <i aria-hidden="true">+</i>
                              )}
                            </span>
                            <b>卡片图</b>
                            <small>
                              集卡槽 ·{" "}
                              {selectedHeroCard?.imageWidth &&
                              selectedHeroCard?.imageHeight
                                ? `${selectedHeroCard.imageWidth} × ${selectedHeroCard.imageHeight}`
                                : "180 × 220"}
                            </small>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                selectedHeroCardIndex >= 0 &&
                                uploadCard(selectedHeroCardIndex, event)
                              }
                            />
                          </label>
                          <label className="studio-hero-layer-asset-choice">
                            <span className="studio-hero-layer-asset-thumb">
                              {selectedHeroLayer.media?.src ? (
                                <img
                                  src={selectedHeroLayer.media.src}
                                  alt="Hero 透明图层预览"
                                />
                              ) : (
                                <i aria-hidden="true">+</i>
                              )}
                            </span>
                            <b>Hero 图层</b>
                            <small>
                              首焦叠加 ·{" "}
                              {selectedHeroLayer.media?.sourceWidth &&
                              selectedHeroLayer.media?.sourceHeight
                                ? `${selectedHeroLayer.media.sourceWidth} × ${selectedHeroLayer.media.sourceHeight}`
                                : "透明 PNG"}
                            </small>
                            <input
                              type="file"
                              accept="image/png,image/webp,image/avif"
                              onChange={(event) =>
                                uploadHeroLayer(
                                  selectedHeroLayer.id,
                                  event,
                                )
                              }
                            />
                          </label>
                        </div>
                        <p className="studio-hero-layer-canvas-hint">
                          {selectedHeroLayer.presentation ===
                          "video-transition"
                            ? "视频只负责解锁过场；Hero 透明图会在动画结束后按下方位置常驻显示。"
                            : "两张图独立保存：卡片图在集卡槽内居中适配；下方坐标与组合画布只控制 Hero 图层。"}
                        </p>
                        <label className="studio-hero-layer-embedded">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              selectedHeroLayer.embeddedInBase,
                            )}
                            onChange={(event) =>
                              updateHeroLayer(selectedHeroLayer.id, {
                                embeddedInBase: event.target.checked,
                              })
                            }
                          />
                          <span>
                            已烘焙进基础图
                            <small>
                              此状态不会再叠加图片，适合默认赠送的首个道具。
                            </small>
                          </span>
                        </label>
                        <div className="studio-three-fields">
                          <Field label="X">
                            <input
                              type="number"
                              value={selectedHeroLayer.x}
                              disabled={selectedHeroLayer.embeddedInBase}
                              onChange={(event) =>
                                updateHeroLayer(selectedHeroLayer.id, {
                                  x: Number(event.target.value) || 0,
                                })
                              }
                              data-testid="config-hero-layer-x"
                            />
                          </Field>
                          <Field label="Y">
                            <input
                              type="number"
                              value={selectedHeroLayer.y}
                              disabled={selectedHeroLayer.embeddedInBase}
                              onChange={(event) =>
                                updateHeroLayer(selectedHeroLayer.id, {
                                  y: Number(event.target.value) || 0,
                                })
                              }
                              data-testid="config-hero-layer-y"
                            />
                          </Field>
                          <Field label="宽度">
                            <input
                              type="number"
                              min="8"
                              max="750"
                              value={selectedHeroLayer.width}
                              disabled={selectedHeroLayer.embeddedInBase}
                              onChange={(event) =>
                                updateHeroLayer(selectedHeroLayer.id, {
                                  width: Math.max(
                                    8,
                                    Number(event.target.value) || 8,
                                  ),
                                })
                              }
                              data-testid="config-hero-layer-width"
                            />
                          </Field>
                        </div>
                        <div className="studio-two-fields">
                          <Field label="旋转角度">
                            <input
                              type="number"
                              min="-180"
                              max="180"
                              value={selectedHeroLayer.rotation}
                              disabled={selectedHeroLayer.embeddedInBase}
                              onChange={(event) =>
                                updateHeroLayer(selectedHeroLayer.id, {
                                  rotation:
                                    Number(event.target.value) || 0,
                                })
                              }
                            />
                          </Field>
                          <Field label="图层顺序">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={selectedHeroLayer.zIndex}
                              disabled={selectedHeroLayer.embeddedInBase}
                              onChange={(event) =>
                                updateHeroLayer(selectedHeroLayer.id, {
                                  zIndex: Math.max(
                                    1,
                                    Math.min(
                                      20,
                                      Number(event.target.value) || 1,
                                    ),
                                  ),
                                })
                              }
                            />
                          </Field>
                        </div>
                        <button
                          type="button"
                          className="studio-hero-layer-reset"
                          onClick={() =>
                            updateHeroLayer(selectedHeroLayer.id, {
                              x: 0,
                              y: 0,
                              width: 64,
                              rotation: 0,
                              zIndex: 2,
                            })
                          }
                        >
                          重置当前图层位置
                        </button>
                      </>
                    )}
                    {selectedHeroLayer.presentation ===
                      "video-transition" && (
                      <div
                        className="studio-hero-video-editor"
                        data-testid="config-hero-video-editor"
                      >
                        <p>
                          获得本卡后在 Hero 容器内播放一次过场；视频与首尾帧共享同一套裁切和焦点规则，并位于渐变 Mask 下方。
                        </p>
                        <section
                          className="studio-hero-transition-library"
                          data-testid="config-hero-transition-library"
                        >
                          <div className="studio-hero-transition-library-heading">
                            <div>
                              <strong>已上传动画</strong>
                              <small>可被多个道具卡共用</small>
                            </div>
                            <span>{heroTransitionLibrary.length} 个</span>
                          </div>
                          {heroTransitionLibrary.length > 0 ? (
                            <div
                              className="studio-hero-transition-options"
                              role="radiogroup"
                              aria-label="选择已上传的过场动画"
                            >
                              {heroTransitionLibrary.map((transition) => {
                                const selected =
                                  transition.key ===
                                  selectedHeroTransitionKey;
                                const { media } = transition;
                                return (
                                  <button
                                    key={transition.key}
                                    type="button"
                                    className="studio-hero-transition-option"
                                    data-selected={selected}
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() =>
                                      reuseHeroTransition(
                                        selectedHeroLayer,
                                        transition,
                                      )
                                    }
                                  >
                                    <span className="studio-hero-transition-thumb">
                                      {media.poster ? (
                                        <span
                                          className="studio-hero-transition-poster"
                                          style={{
                                            backgroundImage: `url(${media.poster})`,
                                          }}
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <i aria-hidden="true">▶</i>
                                      )}
                                    </span>
                                    <span className="studio-hero-transition-copy">
                                      <b>
                                        {transition.sourceLabels.join(
                                          "、",
                                        )}
                                      </b>
                                      <small>
                                        {media.sourceWidth &&
                                        media.sourceHeight
                                          ? `${media.sourceWidth} × ${media.sourceHeight} px`
                                          : "视频过场"}
                                        {` · ${transition.sourceLayerIds.length} 张卡使用`}
                                      </small>
                                    </span>
                                    <span
                                      className="studio-hero-transition-check"
                                      aria-hidden="true"
                                    >
                                      {selected ? "✓" : ""}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="studio-hero-transition-library-empty">
                              暂无可复用动画，上传后会自动出现在这里。
                            </p>
                          )}
                        </section>
                        {selectedHeroLayer.transitionMedia?.src ? (
                          <video
                            src={
                              selectedHeroLayer.transitionMedia.src
                            }
                            poster={
                              selectedHeroLayer.transitionMedia.type ===
                              "video"
                                ? selectedHeroLayer.transitionMedia.poster
                                : undefined
                            }
                            muted
                            controls
                            playsInline
                          />
                        ) : (
                          <div className="studio-hero-video-empty">
                            还没有视频过场
                          </div>
                        )}
                        <Field
                          label="视频地址"
                          hint={
                            selectedHeroLayer.transitionMedia
                              ?.sourceWidth &&
                            selectedHeroLayer.transitionMedia
                              ?.sourceHeight
                              ? `当前文件 ${selectedHeroLayer.transitionMedia.sourceWidth} × ${selectedHeroLayer.transitionMedia.sourceHeight} px`
                              : "建议 MP4/WebM，竖屏 375 × 500 或 750 × 1000。"
                          }
                        >
                          <input
                            type="text"
                            value={
                              selectedHeroLayer.transitionMedia?.src ??
                              ""
                            }
                            onChange={(event) =>
                              updateHeroLayer(selectedHeroLayer.id, {
                                transitionMedia: event.target.value
                                  ? {
                                      type: "video",
                                      src: event.target.value,
                                      poster:
                                        selectedHeroLayer
                                          .transitionMedia?.type ===
                                        "video"
                                          ? selectedHeroLayer
                                              .transitionMedia.poster
                                          : undefined,
                                      fit:
                                        activeDraft.pack.assets.heroMedia
                                          .fit ?? "cover",
                                      position:
                                        activeDraft.pack.assets.heroMedia
                                          .position ?? "center top",
                                    }
                                  : undefined,
                              })
                            }
                            data-testid="config-hero-video-source"
                          />
                        </Field>
                        <div className="studio-hero-layer-asset-actions">
                          <label className="studio-mini-upload">
                            上传新视频
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime"
                              onChange={(event) =>
                                uploadHeroTransitionVideo(
                                  selectedHeroLayer.id,
                                  event,
                                )
                              }
                            />
                          </label>
                          <label className="studio-mini-upload">
                            上传封面图
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                uploadHeroTransitionPoster(
                                  selectedHeroLayer.id,
                                  event,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {selectedHeroLayer.presentation === "none" && (
                      <div className="studio-hero-no-effect-note">
                        这张卡仍会正常点亮和计入集卡进度，但不会改变
                        Hero 画面。
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
            <Field label="卡册名称">
              <input
                type="text"
                value={activeDraft.content.collectionName}
                onChange={(event) =>
                  updateContent({ collectionName: event.target.value })
                }
              />
            </Field>
            <div className="studio-two-fields">
              <Field label="进度动词">
                <input
                  type="text"
                  value={activeDraft.content.collectionProgressVerb}
                  onChange={(event) =>
                    updateContent({
                      collectionProgressVerb: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="卡片单位">
                <input
                  type="text"
                  value={activeDraft.content.cardNoun}
                  onChange={(event) =>
                    updateContent({ cardNoun: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="未获得卡片名称">
              <input
                type="text"
                value={activeDraft.content.missingCardLabel}
                onChange={(event) =>
                  updateContent({ missingCardLabel: event.target.value })
                }
              />
            </Field>
            <label className="studio-mini-upload">
              批量上传卡片（按文件顺序映射前 {activeDraft.content.cards.length} 张）
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={uploadCards}
              />
            </label>
            <div className="studio-item-list">
              {activeDraft.content.cards.map((card, index) => {
                const knownSize = card.image
                  ? KNOWN_ASSET_SIZES[card.image]
                  : undefined;
                const sourceWidth = card.imageWidth ?? knownSize?.width;
                const sourceHeight = card.imageHeight ?? knownSize?.height;
                return (
                  <details className="studio-item" key={card.id}>
                    <summary>
                      <i
                        className="studio-item-thumb"
                        style={{ background: card.accent }}
                      >
                        {card.image ? (
                          <img src={card.image} alt="" />
                        ) : (
                          <span>{card.emoji}</span>
                        )}
                      </i>
                      <span className="studio-item-name">
                        {index + 1}. {card.name}
                      </span>
                      <small>{card.rarity}</small>
                    </summary>
                    <div>
                      <AssetPreview
                        src={card.image}
                        fallback={card.emoji}
                        alt={`${card.name}当前素材`}
                        variant="card"
                        displaySize="59 × 72 px（约 5:6）"
                        recommended="建议透明 PNG/WebP 180 × 220 px（约 3×），主体居中并留 8% 安全边。"
                        sourceWidth={sourceWidth}
                        sourceHeight={sourceHeight}
                        testId={
                          card.id === "watergun"
                            ? "config-card-preview-watergun"
                            : undefined
                        }
                        sizeHintTestId={
                          index === 0 ? "config-card-size-hint" : undefined
                        }
                      />
                      <Field label="卡片名称">
                        <input
                          type="text"
                          value={card.name}
                          onChange={(event) =>
                            updateCard(index, { name: event.target.value })
                          }
                        />
                      </Field>
                      <div className="studio-two-fields">
                        <Field label="Emoji 兜底">
                          <input
                            type="text"
                            value={card.emoji}
                            onChange={(event) =>
                              updateCard(index, {
                                emoji: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <ColorField
                          label="卡片强调色"
                          value={card.accent}
                          onChange={(value) =>
                            updateCard(index, { accent: value })
                          }
                        />
                      </div>
                      <Field label="素材地址">
                        <input
                          type="text"
                          value={card.image ?? ""}
                          onChange={(event) => {
                            const image = event.target.value || undefined;
                            const size = image
                              ? KNOWN_ASSET_SIZES[image]
                              : undefined;
                            updateCard(index, {
                              image,
                              imageAssetId: undefined,
                              imageWidth: size?.width,
                              imageHeight: size?.height,
                            });
                          }}
                        />
                      </Field>
                      <label className="studio-mini-upload">
                        上传替换 · 推荐 180 × 220 px
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => uploadCard(index, event)}
                        />
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
            <h3 className="studio-small-heading">奖励档位</h3>
            <div className="studio-item-list">
              {activeDraft.content.tiers.map((tier, index) => {
                const rewardImage =
                  tier.image ??
                  (tier.kind === "grand"
                    ? activeDraft.pack.assets.grandRewardImage
                    : undefined);
                const knownSize = rewardImage
                  ? KNOWN_ASSET_SIZES[rewardImage]
                  : undefined;
                const sourceWidth = tier.imageWidth ?? knownSize?.width;
                const sourceHeight = tier.imageHeight ?? knownSize?.height;
                const isGrand = tier.kind === "grand";
                return (
                  <details className="studio-item" key={tier.id}>
                    <summary>
                      <i
                        className={`studio-item-thumb reward ${
                          isGrand ? "grand" : "coupon"
                        }`}
                      >
                        {rewardImage ? (
                          <img src={rewardImage} alt="" />
                        ) : (
                          <span>{tier.icon}</span>
                        )}
                      </i>
                      <span className="studio-item-name">
                        集齐 {tier.threshold} 种 · {tier.title}
                      </span>
                      <small>{tier.icon}</small>
                    </summary>
                    <div>
                      <AssetPreview
                        src={rewardImage}
                        fallback={tier.icon}
                        alt={`${tier.title}当前素材`}
                        variant={isGrand ? "grand" : "coupon"}
                        displaySize={
                          isGrand
                            ? "44 × 30 px（约 1.46:1）"
                            : "46 × 27 px（约 1.7:1）"
                        }
                        recommended={
                          isGrand
                            ? "建议透明 PNG/WebP 至少 132 × 90 px，主体居中。"
                            : "默认券框由模板实时绘制；如替换图片，建议透明 PNG/WebP 至少 140 × 82 px。"
                        }
                        sourceWidth={sourceWidth}
                        sourceHeight={sourceHeight}
                        testId={
                          isGrand
                            ? "config-grand-reward-preview"
                            : undefined
                        }
                        sizeHintTestId={
                          index === 0
                            ? "config-reward-size-hint"
                            : undefined
                        }
                      />
                      <div className="studio-two-fields">
                        <Field label="集齐种数">
                          <input
                            type="number"
                            min="1"
                            max="9"
                            value={tier.threshold}
                            onChange={(event) =>
                              updateTier(index, {
                                threshold: Math.max(
                                  1,
                                  Math.min(9, Number(event.target.value)),
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="金额/奖励">
                          <input
                            type="text"
                            value={tier.amount}
                            onChange={(event) =>
                              updateTier(index, {
                                amount: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="奖励名称">
                        <input
                          type="text"
                          value={tier.title}
                          onChange={(event) =>
                            updateTier(index, {
                              title: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="使用条件">
                        <input
                          type="text"
                          value={tier.condition}
                          onChange={(event) =>
                            updateTier(index, {
                              condition: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="奖励图中文字 / 无图片时兜底"
                        hint="前三档默认由模板实时绘制券框与文字"
                      >
                        <input
                          type="text"
                          value={tier.icon}
                          onChange={(event) =>
                            updateTier(index, {
                              icon: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="奖励图片地址">
                        <input
                          type="text"
                          value={rewardImage ?? ""}
                          onChange={(event) => {
                            const image = event.target.value || undefined;
                            const size = image
                              ? KNOWN_ASSET_SIZES[image]
                              : undefined;
                            updateTierAsset(index, {
                              image,
                              imageWidth: size?.width,
                              imageHeight: size?.height,
                            });
                          }}
                        />
                      </Field>
                      <label className="studio-mini-upload">
                        上传奖励图 ·{" "}
                        {isGrand ? "建议至少 132 × 90 px" : "建议至少 140 × 82 px"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => uploadTier(index, event)}
                        />
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
            <details className="studio-subdetails">
              <summary>集卡模块高级样式</summary>
              <div className="studio-subsection-body">
                <Field
                  label="奖励货架皮肤"
                  hint="展示容器 355 × 166 px；建议导出 1065 × 498 px。"
                >
                  <input
                    type="text"
                    value={activeDraft.pack.assets.rewardShelfImage ?? ""}
                    onChange={(event) =>
                      updatePackAsset(
                        "rewardShelfImage",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field
                  label="优惠券框"
                  hint="前三档展示约 46 × 27 px；建议透明图至少 140 × 82 px。"
                >
                  <input
                    type="text"
                    value={activeDraft.pack.assets.tierFrameImage ?? ""}
                    onChange={(event) =>
                      updatePackAsset("tierFrameImage", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="已获得卡框"
                  hint="展示容器约 59 × 72 px；建议透明图 180 × 220 px。"
                >
                  <input
                    type="text"
                    value={
                      activeDraft.pack.assets.cardOwnedFrameImage ?? ""
                    }
                    onChange={(event) =>
                      updatePackAsset(
                        "cardOwnedFrameImage",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field
                  label="未获得卡框"
                  hint="展示容器约 59 × 72 px；建议透明图 180 × 220 px。"
                >
                  <input
                    type="text"
                    value={
                      activeDraft.pack.assets.cardMissingFrameImage ?? ""
                    }
                    onChange={(event) =>
                      updatePackAsset(
                        "cardMissingFrameImage",
                        event.target.value,
                      )
                    }
                  />
                </Field>
              </div>
            </details>
          </div>
        </details>

        <details data-module-id="side-game">
          <SectionSummary index="M3">副玩法卡</SectionSummary>
          <div className="studio-section-body">
            <Field label="模块眉题">
              <input
                type="text"
                value={activeDraft.content.sideGame.eyebrow}
                onChange={(event) =>
                  updateContent({
                    sideGame: {
                      ...activeDraft.content.sideGame,
                      eyebrow: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="副玩法标题">
              <input
                type="text"
                value={activeDraft.content.sideGame.title}
                onChange={(event) =>
                  updateContent({
                    sideGame: {
                      ...activeDraft.content.sideGame,
                      title: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="副玩法说明">
              <textarea
                value={activeDraft.content.sideGame.description}
                onChange={(event) =>
                  updateContent({
                    sideGame: {
                      ...activeDraft.content.sideGame,
                      description: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field
              label="角色图片地址"
              hint="页面展示区域约 70 × 78 px；建议透明 PNG/WebP 210 × 234 px。"
            >
              <input
                type="text"
                value={activeDraft.content.sideGame.image ?? ""}
                onChange={(event) =>
                  updateContent({
                    sideGame: {
                      ...activeDraft.content.sideGame,
                      image: event.target.value || undefined,
                    },
                  })
                }
              />
            </Field>
            <div className="studio-two-fields">
              <Field label="Emoji 兜底">
                <input
                  type="text"
                  value={activeDraft.content.sideGame.visual}
                  onChange={(event) =>
                    updateContent({
                      sideGame: {
                        ...activeDraft.content.sideGame,
                        visual: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="按钮文案">
                <input
                  type="text"
                  value={activeDraft.content.sideGame.cta}
                  onChange={(event) =>
                    updateContent({
                      sideGame: {
                        ...activeDraft.content.sideGame,
                        cta: event.target.value,
                      },
                    })
                  }
                />
              </Field>
            </div>
            <div className="studio-two-fields">
              <Field label="角标">
                <input
                  type="text"
                  value={activeDraft.content.sideGame.badge}
                  onChange={(event) =>
                    updateContent({
                      sideGame: {
                        ...activeDraft.content.sideGame,
                        badge: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="点击提示">
                <input
                  type="text"
                  value={activeDraft.content.sideGame.announcement}
                  onChange={(event) =>
                    updateContent({
                      sideGame: {
                        ...activeDraft.content.sideGame,
                        announcement: event.target.value,
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        </details>

        <details data-module-id="tasks">
          <SectionSummary index="M4">任务区</SectionSummary>
          <div className="studio-section-body">
            <Field label="任务区标题">
              <input
                type="text"
                value={activeDraft.content.tasksTitle}
                onChange={(event) =>
                  updateContent({ tasksTitle: event.target.value })
                }
              />
            </Field>
            <div className="studio-two-fields">
              <Field label="任务 Tab 1">
                <input
                  type="text"
                  value={activeDraft.content.drawTabLabel}
                  onChange={(event) =>
                    updateContent({ drawTabLabel: event.target.value })
                  }
                />
              </Field>
              <Field label="任务 Tab 2">
                <input
                  type="text"
                  value={activeDraft.content.energyTabLabel}
                  onChange={(event) =>
                    updateContent({ energyTabLabel: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="studio-item-list">
              {activeDraft.content.tasks.map((task, index) => (
                <details className="studio-item" key={task.id}>
                  <summary>
                    <i className="studio-item-thumb compact">
                      <span>{task.icon}</span>
                    </i>
                    <span className="studio-item-name">{task.title}</span>
                    <small>
                      {task.target} 次 / +{task.reward}
                    </small>
                  </summary>
                  <div>
                    <div className="studio-two-fields">
                      <Field label="图标">
                        <input
                          type="text"
                          value={task.icon}
                          onChange={(event) =>
                            updateTask(index, { icon: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="按钮文案">
                        <input
                          type="text"
                          value={task.action}
                          onChange={(event) =>
                            updateTask(index, { action: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="任务标题">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(event) =>
                          updateTask(index, { title: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="任务说明">
                      <textarea
                        value={task.description}
                        onChange={(event) =>
                          updateTask(index, {
                            description: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className="studio-two-fields">
                      <Field label="完成目标">
                        <input
                          type="number"
                          min="1"
                          value={task.target}
                          onChange={(event) =>
                            updateTask(index, {
                              target: Math.max(
                                1,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field label="奖励次数">
                        <input
                          type="number"
                          min="0"
                          value={task.reward}
                          onChange={(event) =>
                            updateTask(index, {
                              reward: Math.max(
                                0,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>

        <details data-module-id="topics">
          <SectionSummary index="M5">话题与灵感</SectionSummary>
          <div className="studio-section-body">
            <Field label="英文眉题">
              <input
                type="text"
                value={activeDraft.content.topicEyebrow}
                onChange={(event) =>
                  updateContent({ topicEyebrow: event.target.value })
                }
              />
            </Field>
            <Field label="话题区标题">
              <input
                type="text"
                value={activeDraft.content.topicTitle}
                onChange={(event) =>
                  updateContent({ topicTitle: event.target.value })
                }
              />
            </Field>
            <Field label="话题标签" hint="每行一个，当前模板固定 6 个槽位">
              <textarea
                value={activeDraft.content.topicChips.join("\n")}
                onChange={(event) =>
                  updateContent({
                    topicChips: event.target.value
                      .split("\n")
                      .slice(0, 6),
                  })
                }
              />
            </Field>
            <div className="studio-item-list">
              {activeDraft.content.inspirationCards.map((card, index) => (
                <details
                  className="studio-item"
                  key={`${index}-${card.title}`}
                >
                  <summary>
                    <i className="studio-item-thumb compact">
                      {card.image ? (
                        <img src={card.image} alt="" />
                      ) : (
                        <span>{card.emoji}</span>
                      )}
                    </i>
                    <span className="studio-item-name">
                      灵感卡 {index + 1} · {card.title}
                    </span>
                  </summary>
                  <div>
                    <Field
                      label="图片地址"
                      hint="图片在卡片内按 cover 展示；建议至少 600 px 宽。"
                    >
                      <input
                        type="text"
                        value={card.image ?? ""}
                        onChange={(event) =>
                          updateInspirationCard(index, {
                            image: event.target.value || undefined,
                          })
                        }
                      />
                    </Field>
                    <div className="studio-two-fields">
                      <Field label="Emoji 兜底">
                        <input
                          type="text"
                          value={card.emoji}
                          onChange={(event) =>
                            updateInspirationCard(index, {
                              emoji: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="眉题">
                        <input
                          type="text"
                          value={card.eyebrow}
                          onChange={(event) =>
                            updateInspirationCard(index, {
                              eyebrow: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="标题">
                      <input
                        type="text"
                        value={card.title}
                        onChange={(event) =>
                          updateInspirationCard(index, {
                            title: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>

        <details data-module-id="discovery">
          <SectionSummary index="M6">内容发现</SectionSummary>
          <div className="studio-section-body">
            <Field label="模块眉题">
              <input
                type="text"
                value={activeDraft.content.discoveryEyebrow}
                onChange={(event) =>
                  updateContent({ discoveryEyebrow: event.target.value })
                }
              />
            </Field>
            <Field label="内容发现标题">
              <input
                type="text"
                value={activeDraft.content.discoveryTitle}
                onChange={(event) =>
                  updateContent({ discoveryTitle: event.target.value })
                }
              />
            </Field>
            <div className="studio-item-list">
              {activeDraft.content.venues.map((venue, index) => (
                <details
                  className="studio-item"
                  key={`${index}-${venue.title}`}
                >
                  <summary>
                    <i className="studio-item-thumb compact">
                      <img src={venue.image} alt="" />
                    </i>
                    <span className="studio-item-name">
                      内容卡 {index + 1} · {venue.title}
                    </span>
                  </summary>
                  <div>
                    <Field
                      label="封面图片地址"
                      hint="双列卡片按 cover 展示；建议至少 600 × 720 px。"
                    >
                      <input
                        type="text"
                        value={venue.image}
                        onChange={(event) =>
                          updateVenue(index, { image: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="地点">
                      <input
                        type="text"
                        value={venue.location}
                        onChange={(event) =>
                          updateVenue(index, {
                            location: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="标题">
                      <input
                        type="text"
                        value={venue.title}
                        onChange={(event) =>
                          updateVenue(index, { title: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>

        <details data-module-id="activities">
          <SectionSummary index="M7">更多精彩活动</SectionSummary>
          <div className="studio-section-body">
            <p className="studio-section-note">
              当前模板固定两个 Banner 位；图片与跳转能力可在下一版数据模型中继续扩展。
            </p>
            {activeDraft.content.activityBanners.map((banner, index) => (
              <div
                className="studio-inline-card"
                key={`${index}-${banner.title}`}
              >
                <b>活动 Banner {index + 1}</b>
                <input
                  type="text"
                  value={banner.eyebrow}
                  onChange={(event) => {
                    const activityBanners = cloneValue(
                      activeDraft.content.activityBanners,
                    );
                    activityBanners[index].eyebrow = event.target.value;
                    updateContent({ activityBanners });
                  }}
                  aria-label={`Banner ${index + 1} 眉题`}
                />
                <input
                  type="text"
                  value={banner.title}
                  onChange={(event) => {
                    const activityBanners = cloneValue(
                      activeDraft.content.activityBanners,
                    );
                    activityBanners[index].title = event.target.value;
                    updateContent({ activityBanners });
                  }}
                  aria-label={`Banner ${index + 1} 标题`}
                />
              </div>
            ))}
          </div>
        </details>
        </div>
      </aside>
      )}
    </div>
  );
}
