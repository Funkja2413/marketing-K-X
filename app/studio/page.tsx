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
  type CampaignThemePack,
  type ThemeId,
} from "../campaign-theme-packs";

const DRAFTS_STORAGE_KEY = "campaign-studio-drafts-v1";
const DEFAULT_UPDATED_AT = "2026-07-31T00:00:00.000Z";
const CANVAS_MIN_ZOOM = 0.4;
const CANVAS_MAX_ZOOM = 1.25;

type AiStatus = "idle" | "generating" | "ready";
type StudioCanvasMode = "page" | "flow";

type AiTarget = {
  draftId: string;
  pageId: string;
  kind: "hero" | "card" | "reward";
  moduleId: "M1" | "M2";
  slotId: string;
  entityId?: string;
  label: string;
  displaySize: string;
  outputSize: string;
  accepts: string;
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

type AiCandidateGroup = {
  id: string;
  draftId: string;
  pageId: string;
  prompt: string;
  target: AiTarget | null;
  references: AiReference[];
  candidates: AiCandidate[];
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
  "heroMedia"
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

function createHeroAiTarget(draft: CampaignSkinDraft): AiTarget {
  return {
    draftId: draft.id,
    pageId: "campaign-main",
    kind: "hero",
    moduleId: "M1",
    slotId: "m1.hero-media",
    label: "M1 · Hero 首焦",
    displaySize: "375 × 460 px",
    outputSize: "1125 × 1380 px",
    accepts: "图片 / 视频 · Cover · UI 安全区",
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
      height: currentHero.sourceHeight ?? 1380,
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
            imageWidth: candidate.width,
            imageHeight: candidate.height,
          }
        : card,
    );
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

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

export default function CampaignStudio() {
  const [drafts, setDrafts] =
    useState<CampaignSkinDraft[]>(createStarterDrafts);
  const [activeId, setActiveId] = useState("starter-summer");
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("修改会即时出现在手机预览中");
  const [importError, setImportError] = useState("");
  const [h5EditMode, setH5EditMode] = useState(true);
  const [canvasMode, setCanvasMode] =
    useState<StudioCanvasMode>("page");
  const [selectedPageId, setSelectedPageId] =
    useState("campaign-main");
  const [flowEdges, setFlowEdges] = useState<CampaignFlowEdge[]>(
    () => cloneValue(CAMPAIGN_FLOW_EDGES),
  );
  const [aiTarget, setAiTarget] = useState<AiTarget | null>(null);
  const [aiPrompt, setAiPrompt] = useState(
    "生成一张更有冲浪速度感的夏日首焦，保留当前 IP 和标题",
  );
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
  const [lastAiCommit, setLastAiCommit] =
    useState<AiCommitHistory | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(0.75);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const fitModeRef = useRef(true);
  const previewWorldRef = useRef<HTMLDivElement>(null);
  const phoneStageRef = useRef<HTMLDivElement>(null);
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
  } | null>(null);

  const activeDraft =
    drafts.find((draft) => draft.id === activeId) ?? drafts[0];
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
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!activeDraft.pack.assets.heroMedia.src) issues.push("缺少 Hero");
    if (activeDraft.content.cards.length !== 9) issues.push("卡片不是 9 张");
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
    return issues;
  }, [activeDraft]);

  useEffect(() => {
    window.queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const validDrafts = parsed.filter(isDraft);
            if (validDrafts.length > 0) {
              setDrafts(validDrafts);
              setActiveId(validDrafts[0].id);
            }
          }
        }
      } catch {
        setMessage("本地草稿读取失败，已恢复默认方案");
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        DRAFTS_STORAGE_KEY,
        JSON.stringify(drafts),
      );
    } catch {
      window.queueMicrotask(() =>
        setMessage("草稿素材较大，请及时导出 JSON 备份"),
      );
    }
  }, [drafts, hydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, []);

  useEffect(() => {
    const world = previewWorldRef.current;
    if (!world) return;
    const updateFit = () => {
      if (!fitModeRef.current) return;
      setCanvasZoom(calculateCanvasFitZoom());
      setCanvasPan({ x: 0, y: 0 });
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(world);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fitModeRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      setCanvasZoom(calculateCanvasFitZoom());
      setCanvasPan({ x: 0, y: 0 });
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

  function clampCanvasZoom(value: number) {
    return Math.min(
      CANVAS_MAX_ZOOM,
      Math.max(CANVAS_MIN_ZOOM, value),
    );
  }

  function calculateCanvasFitZoom() {
    const world = previewWorldRef.current;
    const stage = phoneStageRef.current;
    if (!world || !stage) return 0.75;
    const bounds = world.getBoundingClientRect();
    return Math.min(
      1,
      Math.max(
        CANVAS_MIN_ZOOM,
        Math.min(
          (bounds.width - 96) / stage.offsetWidth,
          (bounds.height - 72) / stage.offsetHeight,
        ),
      ),
    );
  }

  function adjustCanvasZoom(delta: number) {
    fitModeRef.current = false;
    setCanvasZoom((current) =>
      clampCanvasZoom(Math.round((current + delta) * 20) / 20),
    );
  }

  function fitCanvas() {
    fitModeRef.current = true;
    setCanvasZoom(calculateCanvasFitZoom());
    setCanvasPan({ x: 0, y: 0 });
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
                x: drag.x + event.clientX - drag.startX,
                y: drag.y + event.clientY - drag.startY,
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
    const targetSnapshot = aiTarget ? { ...aiTarget } : null;
    const references = cloneValue(aiReferences);
    const pageId = targetSnapshot?.pageId ?? selectedPageId;
    setAiStatus("generating");
    setLastAiPrompt(prompt);
    setSelectedAiAsset(null);
    setAiTrial(null);
    setAdoptedCandidateId(null);
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
      const canvasWidth = previewWorldRef.current?.clientWidth ?? 1200;
      const leftRoom = Math.max(0, (canvasWidth - 395) / 2);
      const groupX =
        leftRoom >= 430 ? -448 : -Math.max(24, leftRoom - 14);
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
          position: {
            x: groupX + (current.length % 2) * 22,
            y: 56 + current.length * 226,
          },
          collapsed: false,
        },
      ]);
      setAiStatus("ready");
      setMessage(
        targetSnapshot
          ? `已把 3 个「${targetSnapshot.label}」候选作为一组放进 Canvas`
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
    setAiTrial(null);
    setMessage("已确认到当前草稿；尚未应用到活动页");
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

  function applyActive() {
    try {
      window.localStorage.setItem(
        ACTIVE_SKIN_STORAGE_KEY,
        JSON.stringify(activeDraft),
      );
      setMessage("已应用到活动页；打开或刷新活动页即可查看");
    } catch {
      setMessage("应用失败：草稿素材体积超过浏览器容量");
    }
  }

  function exportActive() {
    const blob = new Blob(
      [JSON.stringify(activeDraft, null, 2)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeDraft.name.replace(/[^\w\u4e00-\u9fa5-]+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("当前方案 JSON 已导出");
  }

  function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isDraft(parsed)) {
          throw new Error("配置结构不完整");
        }
        const imported = {
          ...parsed,
          id: `${parsed.baseTheme}-${Date.now()}`,
          name: `${parsed.name} · 导入`,
          updatedAt: new Date().toISOString(),
        };
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

  function uploadHero(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        updateActive((draft) => ({
          ...draft,
          pack: {
            ...draft.pack,
            assets: {
              ...draft.pack.assets,
              heroMedia: {
                type: "video",
                src,
                fit: "cover",
                position: "center top",
              },
            },
          },
        }));
        setMessage("Hero 视频已载入预览");
        return;
      }
      const image = new Image();
      image.onload = () => {
        updateActive((draft) => ({
          ...draft,
          pack: {
            ...draft.pack,
            assets: {
              ...draft.pack.assets,
              heroMedia: {
                type: "image",
                src,
                fit: "cover",
                position: "center top",
                sourceWidth: image.naturalWidth,
                sourceHeight: image.naturalHeight,
              },
            },
          },
        }));
        setMessage(
          `Hero 图片已载入：${image.naturalWidth}×${image.naturalHeight}`,
        );
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  }

  async function uploadCard(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const asset = await readImageAsset(file);
      updateCard(index, {
        image: asset.src,
        imageWidth: asset.width,
        imageHeight: asset.height,
      });
      setMessage(`已替换第 ${index + 1} 张卡片素材`);
    } catch {
      setMessage(`第 ${index + 1} 张卡片素材读取失败`);
    }
  }

  async function uploadCards(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 9);
    event.target.value = "";
    if (files.length === 0) return;
    try {
      const assets = await Promise.all(files.map(readImageAsset));
      updateActive((draft) => ({
        ...draft,
        content: {
          ...draft.content,
          cards: draft.content.cards.map((card, index) => ({
            ...card,
            image: assets[index]?.src ?? card.image,
            imageWidth: assets[index]?.width ?? card.imageWidth,
            imageHeight: assets[index]?.height ?? card.imageHeight,
          })),
        },
      }));
      setMessage(`已按文件顺序批量替换 ${assets.length} 张卡片`);
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

  return (
    <div
      className="studio-shell"
      data-testid="config-tool"
      data-inspector-open={inspectorOpen}
    >
      <aside className="studio-sidebar studio-library">
        <header className="studio-brand">
          <span>Campaign Skin Studio</span>
          <h1>活动换肤配置器</h1>
          <p>用生成目标连接 Chat、Canvas 与活动模块。</p>
        </header>

        <div
          className="studio-ai-chat"
          data-testid="studio-ai-chat"
          data-panel="chat"
        >
          <div className="studio-ai-thread" aria-live="polite">
            <div className="studio-ai-message assistant">
              <small>Campaign Copilot</small>
              <p>
                从右侧模块点击“AI 生成”后，容器规则会作为约束胶囊进入输入框。
                你可以继续补充描述或参考图，结果会成为 Canvas 里的素材组。
              </p>
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
                  新候选已打成一组放进 Canvas；点击其中一张即可出现快捷工具。
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
                placeholder="描述画面、动作、风格，Shift + Enter 换行"
                rows={4}
                data-testid="studio-ai-prompt"
              />

              <div className="studio-ai-composer-actions">
                <label className="studio-ai-reference-button">
                  <span aria-hidden="true">＋</span>
                  添加参考图
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAiReferenceUpload}
                    data-testid="studio-ai-reference-input"
                  />
                </label>
                <small>最多 4 张</small>
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
                  {aiStatus === "generating" ? "···" : "↑"}
                </button>
              </div>
            </div>
            <small>体验版使用现有素材模拟生成，验证完整交互闭环。</small>
          </form>
        </div>
      </aside>

      <section className="studio-canvas">
        <header className="studio-toolbar">
          <div>
            <small>
              {canvasMode === "page" ? "页面画布" : "页面与跳转流程"}
            </small>
            <strong>
              {activeDraft.name} · {selectedPage.name}
            </strong>
          </div>
          <div className="studio-toolbar-actions">
            <div
              className="studio-canvas-mode-toggle"
              role="tablist"
              aria-label="Canvas 视图"
            >
              <button
                type="button"
                role="tab"
                aria-selected={canvasMode === "page"}
                onClick={() => setCanvasMode("page")}
              >
                页面编辑
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={canvasMode === "flow"}
                onClick={() => {
                  setCanvasMode("flow");
                  setSelectedAiAsset(null);
                }}
                data-testid="studio-page-flow-entry"
              >
                页面流程
              </button>
            </div>
            <button
              type="button"
              className={h5EditMode ? "active" : ""}
              onClick={() => {
                setH5EditMode((current) => !current);
                setSelectedAiAsset(null);
              }}
              data-testid="studio-h5-edit-toggle"
            >
              {h5EditMode ? "退出 H5 编辑" : "编辑 H5"}
            </button>
            <button type="button" onClick={resetActive}>
              恢复默认
            </button>
            <button
              type="button"
              onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
            >
              打开活动页
            </button>
            <button
              type="button"
              className="primary"
              onClick={applyActive}
            >
              应用到活动页
            </button>
          </div>
        </header>

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
                {selectedCandidate.target ? "试用" : "绑定到 H5"}
              </button>
              <button
                type="button"
                onClick={() =>
                  selectAiTarget(
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
              缩小
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
              放大
            </button>
            <button
              type="button"
              data-testid="studio-canvas-fit"
              onClick={fitCanvas}
            >
              适应画布
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
                          {group.candidates.length} 个候选
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCandidateGroup(group.id)}
                      aria-expanded={!group.collapsed}
                    >
                      {group.collapsed ? "展开" : "收起"}
                    </button>
                  </header>

                  {!group.collapsed && (
                    <>
                      <div className="studio-ai-candidate-grid">
                        {group.candidates.map((candidate, index) => {
                          const isSelected =
                            selectedAiAsset?.groupId === group.id &&
                            selectedAiAsset.candidateId === candidate.id;
                          const isTrying =
                            group.id === aiTrial?.groupId &&
                            candidate.id === aiTrial.candidate.id;
                          const isAdopted =
                            candidate.id === adoptedCandidateId;
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
                              onClick={(event) => {
                                event.stopPropagation();
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
                                />
                                <i>0{index + 1}</i>
                              </span>
                              <span>
                                <strong>{candidate.label}</strong>
                                <small>
                                  {candidate.width} × {candidate.height}
                                </small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <footer>
                        <span title={group.prompt}>{group.prompt}</span>
                        <small>
                          {group.references.length > 0
                            ? `${group.references.length} 张参考图`
                            : "无参考图"}
                        </small>
                      </footer>
                    </>
                  )}
                </section>
              ))}
            </div>

            <div
              className="studio-phone-stage"
              ref={canvasMode === "page" ? phoneStageRef : undefined}
              data-testid="studio-phone-stage"
              data-canvas-zoom={canvasZoom.toFixed(2)}
              data-h5-mode={h5EditMode ? "edit" : "preview"}
              hidden={canvasMode !== "page"}
              style={
                {
                  "--studio-canvas-scale": canvasZoom,
                } as CSSProperties
              }
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
                      aiTarget?.kind === "card" ? "active" : ""
                    }
                    onClick={() =>
                      selectAiTarget(createCardAiTarget(activeDraft))
                    }
                  >
                    M2 首卡
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
                    key={activeDraft.id}
                    configuration={runtimeConfiguration}
                    initialTheme={activeDraft.baseTheme}
                    persistProgress={false}
                    fixture
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
              ref={canvasMode === "flow" ? phoneStageRef : undefined}
              hidden={canvasMode !== "flow"}
              style={
                {
                  "--studio-canvas-scale": canvasZoom,
                } as CSSProperties
              }
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

        <footer className="studio-status" role="status">
          <span>{message}</span>
          <div className="studio-status-actions">
            {lastAiCommit?.draftId === activeDraft.id && (
              <button type="button" onClick={undoLastAiCommit}>
                撤销 AI 确认
              </button>
            )}
            <button
              type="button"
              onClick={exportActive}
              data-testid="config-export"
            >
              导出当前方案
            </button>
          </div>
        </footer>
      </section>

      {inspectorOpen && (
      <aside className="studio-sidebar studio-inspector">
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
            <button
              type="button"
              className="studio-ai-slot-action"
              onClick={() =>
                selectAiTarget(createHeroAiTarget(activeDraft))
              }
              data-testid="studio-ai-target-hero"
            >
              <span>AI 生成 Hero 候选</span>
              <small>自动携带 375 × 460 容器、安全区与当前主题</small>
            </button>
            <label className="studio-upload">
              <strong>上传 Hero 图片或视频</strong>
              <span>
                页面容器 375 × 460 px · 推荐素材 1125 × 1380 px；视频需静音循环
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={uploadHero}
              />
            </label>
            <Field label="素材地址">
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
              当前模板固定 9 张卡片和 4 档奖励；稳定 ID 不随换肤改变。
            </p>
            <div className="studio-ai-module-actions">
              <button
                type="button"
                className="studio-ai-slot-action"
                onClick={() =>
                  selectAiTarget(createCardAiTarget(activeDraft))
                }
                data-testid="studio-ai-target-card"
              >
                <span>AI 生成首张卡片</span>
                <small>180 × 220 · 透明背景 · 8% 安全边</small>
              </button>
              <button
                type="button"
                className="studio-ai-slot-action"
                onClick={() =>
                  selectAiTarget(createRewardAiTarget(activeDraft))
                }
                data-testid="studio-ai-target-reward"
              >
                <span>AI 生成终极奖励</span>
                <small>按大奖槽位自动处理透明图</small>
              </button>
            </div>
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
              批量上传卡片（按文件顺序映射前 9 张）
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
