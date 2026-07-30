"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CardDefinition = {
  id: string;
  name: string;
  emoji: string;
  image?: string;
  accent: string;
  rarity: "普通" | "稀有";
  weight: number;
};

type TierDefinition = {
  id: string;
  threshold: number;
  amount: string;
  title: string;
  condition: string;
  icon: string;
  kind: "coupon" | "grand";
};

type TaskId = "browse" | "post" | "share" | "store" | "gift";

type TaskDefinition = {
  id: TaskId;
  icon: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  action: string;
  repeatable?: boolean;
};

type Coupon = {
  id: string;
  tierId: string;
  title: string;
  amount: string;
  condition: string;
  expiresAt: string;
  status: "unused" | "used";
};

type ThemeId = "summer" | "night";

type CampaignProgress = {
  dailyCycle: string;
  drawBalance: number;
  duplicateStreak: number;
  cardCounts: Record<string, number>;
  taskProgress: Record<TaskId, number>;
  claimedTiers: string[];
  coupons: Coupon[];
};

type CampaignState = {
  version: 2;
  activeTheme: ThemeId;
  themes: Record<ThemeId, CampaignProgress>;
};

type ThemeDefinition = {
  id: ThemeId;
  navLabel: string;
  accessibleTitle: string;
  heroImage: string;
  heroMode: "summer-keyvisual" | "night-keyvisual";
  collectionName: string;
  cardNoun: string;
  drawCta: string;
  rewardVerb: string;
  tasksTitle: string;
  drawTabLabel: string;
  energyTabLabel: string;
  topicEyebrow: string;
  topicTitle: string;
  topicChips: string[];
  inspirationCards: Array<{
    emoji: string;
    image?: string;
    eyebrow: string;
    title: string;
    taskId: TaskId;
  }>;
  cards: CardDefinition[];
  tiers: TierDefinition[];
  tasks: TaskDefinition[];
};

type DrawResult = {
  cardId: string;
  isNew: boolean;
  newlyUnlocked: string[];
};

const STORAGE_KEY = "summer-campaign-multitheme-v2";
const LEGACY_STORAGE_KEY = "night-bites-campaign-v1";

const NIGHT_CARDS: CardDefinition[] = [
  {
    id: "hotpot",
    name: "沸腾火锅",
    emoji: "🥘",
    accent: "#ff7048",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "skewers",
    name: "滋滋烤串",
    emoji: "🍢",
    accent: "#ff9d3d",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "tofu",
    name: "冰爽豆花",
    emoji: "🍧",
    accent: "#f6c8ff",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "crayfish",
    name: "红运龙虾",
    emoji: "🦞",
    accent: "#ff4c3e",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "beer",
    name: "晚风冰杯",
    emoji: "🍺",
    accent: "#ffd55c",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "wrap",
    name: "街角卷饼",
    emoji: "🌯",
    accent: "#8ee66d",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "shrimp",
    name: "鲜活生腌",
    emoji: "🍤",
    accent: "#ff9da6",
    rarity: "普通",
    weight: 0.9,
  },
  {
    id: "coconut",
    name: "月下糖水",
    emoji: "🥥",
    accent: "#78e0cf",
    rarity: "稀有",
    weight: 0.55,
  },
  {
    id: "crown",
    name: "宵夜之王",
    emoji: "👑",
    accent: "#cbff46",
    rarity: "稀有",
    weight: 0.38,
  },
];

const NIGHT_TIERS: TierDefinition[] = [
  {
    id: "tier-2",
    threshold: 2,
    amount: "2",
    title: "夜宵立减券",
    condition: "满9元可用",
    icon: "¥2",
    kind: "coupon",
  },
  {
    id: "tier-4",
    threshold: 4,
    amount: "5",
    title: "夏夜加餐券",
    condition: "满29元可用",
    icon: "¥5",
    kind: "coupon",
  },
  {
    id: "tier-7",
    threshold: 7,
    amount: "43",
    title: "夜宵欢聚券",
    condition: "满99元可用",
    icon: "¥43",
    kind: "coupon",
  },
  {
    id: "tier-9",
    threshold: 9,
    amount: "限定礼",
    title: "金勺纪念礼抽签码",
    condition: "集齐全套即可领取",
    icon: "金勺",
    kind: "grand",
  },
];

const NIGHT_TASKS: TaskDefinition[] = [
  {
    id: "browse",
    icon: "👀",
    title: "浏览今晚开饭活动页",
    description: "每日首次浏览，获得1次抽卡机会",
    target: 1,
    reward: 1,
    action: "明日再来",
  },
  {
    id: "post",
    icon: "📸",
    title: "发布一条夏夜美食灵感",
    description: "每次模拟发布，获得2次抽卡机会",
    target: 3,
    reward: 2,
    action: "去发布",
    repeatable: true,
  },
  {
    id: "share",
    icon: "💌",
    title: "把夜宵局分享给朋友",
    description: "复制活动链接，获得2次抽卡机会",
    target: 1,
    reward: 2,
    action: "去分享",
  },
  {
    id: "store",
    icon: "🧭",
    title: "逛一逛夏夜灵感地图",
    description: "完成一次探索，获得1次抽卡机会",
    target: 1,
    reward: 1,
    action: "去逛逛",
  },
  {
    id: "gift",
    icon: "🎁",
    title: "送出一张重复美食卡",
    description: "好友模拟领取后，获得1次抽卡机会",
    target: 3,
    reward: 1,
    action: "去赠送",
    repeatable: true,
  },
];

const SUMMER_CARDS: CardDefinition[] = [
  {
    id: "watergun",
    name: "鲨鲨水枪",
    emoji: "🔫",
    image: "/figma/equipment-water-gun.webp",
    accent: "#38bdf8",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "watermelon",
    name: "冰镇西瓜",
    emoji: "🍉",
    image: "/figma/equipment-watermelon-bucket.webp",
    accent: "#77e36b",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "surfboard",
    name: "顺风冲浪板",
    emoji: "🏄",
    image: "/figma/equipment-paddle-board.webp",
    accent: "#ffd84d",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "palmtree",
    name: "海岛椰树",
    emoji: "🌴",
    image: "/figma/equipment-palm-tree.webp",
    accent: "#5de08c",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "floatie",
    name: "好运泳圈",
    emoji: "🛟",
    image: "/figma/equipment-pineapple-float.webp",
    accent: "#ff7791",
    rarity: "普通",
    weight: 1,
  },
  {
    id: "deckchair",
    name: "躺赢沙滩椅",
    emoji: "⛱️",
    image: "/figma/equipment-sun-chair.webp",
    accent: "#7f9cff",
    rarity: "普通",
    weight: 0.95,
  },
  {
    id: "icecream",
    name: "浪花冰淇淋",
    emoji: "🍦",
    accent: "#ffb7dd",
    rarity: "普通",
    weight: 0.9,
  },
  {
    id: "sunhat",
    name: "遮阳幸运帽",
    emoji: "👒",
    accent: "#ffc85a",
    rarity: "稀有",
    weight: 0.55,
  },
  {
    id: "luckyhorse",
    name: "马上顺金牌",
    emoji: "🏅",
    accent: "#ccff39",
    rarity: "稀有",
    weight: 0.38,
  },
];

const SUMMER_TIERS: TierDefinition[] = [
  {
    id: "tier-1",
    threshold: 1,
    amount: "3",
    title: "清凉开运券",
    condition: "满15元可用",
    icon: "¥3",
    kind: "coupon",
  },
  {
    id: "tier-4",
    threshold: 4,
    amount: "12",
    title: "玩水装备券",
    condition: "满49元可用",
    icon: "¥12",
    kind: "coupon",
  },
  {
    id: "tier-6",
    threshold: 6,
    amount: "23",
    title: "一顺到底券",
    condition: "满88元可用",
    icon: "¥23",
    kind: "coupon",
  },
  {
    id: "tier-9",
    threshold: 9,
    amount: "限定礼",
    title: "足金顺顺马抽签码",
    condition: "集齐全套即可领取",
    icon: "足金",
    kind: "grand",
  },
];

const SUMMER_TASKS: TaskDefinition[] = [
  {
    id: "post",
    icon: "✨",
    title: "为点亮过的避暑玩水地点投稿",
    description: "每次模拟投稿，获得2次抽装备机会",
    target: 3,
    reward: 2,
    action: "去投稿",
    repeatable: true,
  },
  {
    id: "share",
    icon: "📸",
    title: "带定位&话题发布玩水灵感",
    description: "带#顺风顺水的夏天发布，即得2次机会",
    target: 2,
    reward: 2,
    action: "去投稿",
    repeatable: true,
  },
  {
    id: "store",
    icon: "✨",
    title: "到店点亮避暑玩水商户",
    description: "每次点亮即得1张玩水装备卡",
    target: 6,
    reward: 1,
    action: "去点亮",
    repeatable: true,
  },
  {
    id: "gift",
    icon: "🎁",
    title: "给朋友赠送一张装备卡",
    description: "好友模拟领取后，获得1次抽装备机会",
    target: 3,
    reward: 1,
    action: "去赠送",
    repeatable: true,
  },
  {
    id: "browse",
    icon: "👀",
    title: "浏览本玩水活动页",
    description: "每日首次浏览即得1次抽装备机会",
    target: 1,
    reward: 1,
    action: "明日再来",
  },
];

const THEMES: Record<ThemeId, ThemeDefinition> = {
  summer: {
    id: "summer",
    navLabel: "夏天马上顺",
    accessibleTitle: "这夏夯爆了｜夏天马上顺",
    heroImage: "/figma/crops/hero-scene.webp",
    heroMode: "summer-keyvisual",
    collectionName: "顺风装备册",
    cardNoun: "装备卡",
    drawCta: "抽装备 · 一顺到底",
    rewardVerb: "兑顺顺券",
    tasksTitle: "玩一夏，赚更多",
    drawTabLabel: "抽装备",
    energyTabLabel: "攒体力",
    topicEyebrow: "SUMMER WATER TOPICS",
    topicTitle: "暑期 #灵感话题",
    topicChips: [
      "# 2026暑假接好运",
      "# 暑假快乐",
      "# 今年暑假去哪玩",
      "# 暑假快乐",
      "# 今年暑期去哪玩",
      "# 2026暑假接好运",
    ],
    inspirationCards: [
      {
        emoji: "🍉",
        image: "/figma/topic-hotpot-card.webp",
        eyebrow: "清凉美食指南",
        title: "把夏天吃进这一口",
        taskId: "store",
      },
      {
        emoji: "🌅",
        image: "/figma/topic-sunset-card.webp",
        eyebrow: "晚霞打卡指南",
        title: "晚霞就是天空的诗",
        taskId: "post",
      },
      {
        emoji: "🌊",
        image: "/figma/topic-lake-card.webp",
        eyebrow: "扎进水里夏天",
        title: "把清凉值拉满",
        taskId: "store",
      },
    ],
    cards: SUMMER_CARDS,
    tiers: SUMMER_TIERS,
    tasks: SUMMER_TASKS,
  },
  night: {
    id: "night",
    navLabel: "夏日夜食指南",
    accessibleTitle: "今晚开饭｜夏夜九味收藏计划",
    heroImage: "/og-night.webp",
    heroMode: "night-keyvisual",
    collectionName: "九味卡册",
    cardNoun: "夜宵卡",
    drawCta: "抽一张夜宵卡",
    rewardVerb: "兑夜宵券",
    tasksTitle: "玩一夏，抽更多",
    drawTabLabel: "抽夜宵",
    energyTabLabel: "攒体力",
    topicEyebrow: "SUMMER NIGHT TOPICS",
    topicTitle: "暑期 #灵感话题",
    topicChips: [
      "# 趁热吃顿夏夜小火锅",
      "# 我拍到了夏天的味道",
      "# 下班后的第一口快乐",
    ],
    inspirationCards: [
      {
        emoji: "🥘",
        eyebrow: "深夜沸腾指南",
        title: "这口热气，最懂夏夜",
        taskId: "post",
      },
      {
        emoji: "🍢",
        eyebrow: "街角烟火地图",
        title: "把城市吃到发光",
        taskId: "store",
      },
    ],
    cards: NIGHT_CARDS,
    tiers: NIGHT_TIERS,
    tasks: NIGHT_TASKS,
  },
};

const SUMMER_VENUES = [
  {
    image: "/figma/content-card-lions.webp",
    location: "上海动物园",
    title: "元旦来动物园打卡啦～",
  },
  {
    image: "/figma/content-card-cabin.webp",
    location: "世博文化公园",
    title: "2026元旦许愿接龙！",
  },
  {
    image: "/figma/content-card-lions.webp",
    location: "上海动物园",
    title: "元旦来动物园打卡啦～",
  },
  {
    image: "/figma/content-card-cabin.webp",
    location: "世博文化公园",
    title: "2026元旦许愿接龙！",
  },
];

function CardArtwork({
  card,
  visible = true,
}: {
  card: CardDefinition;
  visible?: boolean;
}) {
  if (card.image) {
    return (
      <img
        className="card-art-image"
        src={card.image}
        alt=""
        aria-hidden="true"
        data-visible={visible}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return <>{visible ? card.emoji : "?"}</>;
}

function getDailyCycle() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function createInitialProgress(drawBalance = 1): CampaignProgress {
  return {
    dailyCycle: getDailyCycle(),
    drawBalance,
    duplicateStreak: 0,
    cardCounts: {},
    taskProgress: {
      browse: 1,
      post: 0,
      share: 0,
      store: 0,
      gift: 0,
    },
    claimedTiers: [],
    coupons: [],
  };
}

function createInitialState(): CampaignState {
  return {
    version: 2,
    activeTheme: "summer",
    themes: {
      summer: createInitialProgress(2),
      night: createInitialProgress(1),
    },
  };
}

function createFigmaFixtureState(): CampaignState {
  const state = createInitialState();
  state.themes.summer = {
    ...state.themes.summer,
    drawBalance: 99,
    cardCounts: {
      watergun: 5,
      watermelon: 3,
      surfboard: 1,
    },
    claimedTiers: ["tier-1"],
    coupons: [
      {
        id: "figma-tier-1",
        tierId: "tier-1",
        title: "清凉开运券",
        amount: "3",
        condition: "满15元可用",
        expiresAt: "2026-08-31",
        status: "unused",
      },
    ],
  };
  return state;
}

function countDistinctCards(
  cardCounts: Record<string, number>,
  cards: CardDefinition[],
) {
  return cards.filter((card) => (cardCounts[card.id] ?? 0) > 0).length;
}

function normalizeProgress(
  input: unknown,
  theme: ThemeDefinition,
): CampaignProgress {
  if (!input || typeof input !== "object") return createInitialProgress();
  const candidate = input as Partial<CampaignProgress>;
  const defaults = createInitialProgress();
  const currentCycle = getDailyCycle();
  const savedCycle =
    typeof candidate.dailyCycle === "string"
      ? candidate.dailyCycle
      : currentCycle;
  const isNewDailyCycle = savedCycle !== currentCycle;
  const cardCounts = Object.fromEntries(
    theme.cards.map((card) => [
      card.id,
      Math.max(0, Number(candidate.cardCounts?.[card.id]) || 0),
    ]),
  );
  const taskProgress = Object.fromEntries(
    theme.tasks.map((task) => [
      task.id,
      isNewDailyCycle
        ? defaults.taskProgress[task.id]
        : Math.min(
            task.target,
            Math.max(
              0,
              candidate.taskProgress?.[task.id] == null
                ? defaults.taskProgress[task.id]
                : Number(candidate.taskProgress[task.id]) || 0,
            ),
          ),
    ]),
  ) as Record<TaskId, number>;
  const claimedTiers = Array.isArray(candidate.claimedTiers)
    ? Array.from(
        new Set(
          candidate.claimedTiers.filter((id) =>
            theme.tiers.some((tier) => tier.id === id),
          ),
        ),
      )
    : [];
  const validCoupons = Array.isArray(candidate.coupons)
    ? candidate.coupons.filter(
        (coupon): coupon is Coupon =>
          Boolean(
            coupon &&
              typeof coupon.id === "string" &&
              typeof coupon.tierId === "string",
          ),
      )
    : [];
  const coupons = Array.from(
    new Map(validCoupons.map((coupon) => [coupon.id, coupon])).values(),
  );

  return {
    dailyCycle: currentCycle,
    drawBalance:
      Math.max(0, Number(candidate.drawBalance) || 0) +
      (isNewDailyCycle
        ? (theme.tasks.find((task) => task.id === "browse")?.reward ?? 0)
        : 0),
    duplicateStreak: Math.max(0, Number(candidate.duplicateStreak) || 0),
    cardCounts,
    taskProgress,
    claimedTiers,
    coupons,
  };
}

function normalizeState(input: unknown, legacyNight?: unknown): CampaignState {
  if (!input || typeof input !== "object") {
    const initial = createInitialState();
    return {
      ...initial,
      themes: {
        summer: createInitialProgress(2),
        night: legacyNight
          ? normalizeProgress(legacyNight, THEMES.night)
          : createInitialProgress(1),
      },
    };
  }
  const candidate = input as Partial<CampaignState>;
  const activeTheme: ThemeId =
    candidate.activeTheme === "night" ? "night" : "summer";
  return {
    version: 2,
    activeTheme,
    themes: {
      summer: candidate.themes?.summer
        ? normalizeProgress(candidate.themes.summer, THEMES.summer)
        : createInitialProgress(2),
      night: candidate.themes?.night
        ? normalizeProgress(candidate.themes.night, THEMES.night)
        : createInitialProgress(1),
    },
  };
}

function pickWeightedCard(
  state: CampaignProgress,
  cards: CardDefinition[],
): { card: CardDefinition; isNew: boolean } {
  const unowned = cards.filter(
    (card) => (state.cardCounts[card.id] ?? 0) === 0,
  );
  const shouldFavorNew =
    unowned.length > 0 &&
    (state.duplicateStreak >= 2 || Math.random() < 0.72);
  const pool = shouldFavorNew ? unowned : cards;
  const totalWeight = pool.reduce((sum, card) => sum + card.weight, 0);
  let cursor = Math.random() * totalWeight;
  const card =
    pool.find((item) => {
      cursor -= item.weight;
      return cursor <= 0;
    }) ?? pool[pool.length - 1];

  return {
    card,
    isNew: (state.cardCounts[card.id] ?? 0) === 0,
  };
}

export default function Home() {
  const [campaignState, setCampaignState] =
    useState<CampaignState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const [activeModal, setActiveModal] = useState<
    "cards" | "prizes" | "rules" | null
  >(null);
  const [giftCardId, setGiftCardId] = useState<string | null>(null);
  const [giftShared, setGiftShared] = useState(false);
  const [taskTab, setTaskTab] = useState<"draw" | "energy">("draw");
  const [toast, setToast] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const taskSectionRef = useRef<HTMLElement | null>(null);
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawPendingRef = useRef(false);
  const pendingTaskIdsRef = useRef<Set<string>>(new Set());
  const claimedTierIdsRef = useRef<Set<string>>(new Set());
  const giftClaimPendingRef = useRef(false);
  const stateEpochRef = useRef(0);
  const fixtureModeRef = useRef(false);

  const theme = THEMES[campaignState.activeTheme];
  const state = campaignState.themes[campaignState.activeTheme];
  const CARD_DEFINITIONS = theme.cards;
  const TIERS = theme.tiers;
  const TASKS = theme.tasks;

  function setState(
    update:
      | CampaignProgress
      | ((current: CampaignProgress) => CampaignProgress),
  ) {
    const targetTheme = campaignState.activeTheme;
    setCampaignState((current) => {
      const currentProgress = current.themes[targetTheme];
      const nextProgress =
        typeof update === "function" ? update(currentProgress) : update;
      return {
        ...current,
        themes: {
          ...current.themes,
          [targetTheme]: nextProgress,
        },
      };
    });
  }

  const uniqueCount = useMemo(
    () => countDistinctCards(state.cardCounts, CARD_DEFINITIONS),
    [CARD_DEFINITIONS, state.cardCounts],
  );
  const nextTier =
    TIERS.find((tier) => uniqueCount < tier.threshold) ?? TIERS[TIERS.length - 1];

  useEffect(() => {
    const hydrateFromStorage = () => {
      try {
        if (
          new URLSearchParams(window.location.search).get("fixture") ===
          "figma"
        ) {
          fixtureModeRef.current = true;
          setCampaignState(createFigmaFixtureState());
          return;
        }
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setCampaignState(normalizeState(JSON.parse(saved)));
        } else {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          setCampaignState(
            normalizeState(undefined, legacy ? JSON.parse(legacy) : undefined),
          );
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        setCampaignState(createInitialState());
      } finally {
        setReady(true);
      }
    };
    window.queueMicrotask(hydrateFromStorage);
  }, []);

  useEffect(() => {
    if (!ready || fixtureModeRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState));
    } catch {
      // The demo stays usable even if browser storage is unavailable.
    }
  }, [campaignState, ready]);

  useEffect(() => {
    const refreshDailyTasks = () => {
      const currentCycle = getDailyCycle();
      setCampaignState((current) => {
        const alreadyCurrent = Object.values(current.themes).every(
          (progress) => progress.dailyCycle === currentCycle,
        );
        return alreadyCurrent ? current : normalizeState(current);
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshDailyTasks();
    };
    const intervalId = window.setInterval(refreshDailyTasks, 60_000);
    window.addEventListener("focus", refreshDailyTasks);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshDailyTasks);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function announce(message: string) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2600);
  }

  function scrollToTasks() {
    taskSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function switchTheme(nextTheme: ThemeId) {
    if (
      nextTheme === campaignState.activeTheme ||
      isDrawing ||
      drawPendingRef.current
    ) {
      return;
    }
    setCampaignState((current) => ({
      ...current,
      activeTheme: nextTheme,
    }));
    setDrawResult(null);
    setGiftCardId(null);
    setGiftShared(false);
    setActiveModal(null);
    setTaskTab("draw");
    setResetArmed(false);
  }

  function handleDraw() {
    if (!ready || isDrawing || drawPendingRef.current) return;
    if (state.drawBalance <= 0) {
      announce("抽卡机会用完啦，完成任务可以继续抽");
      scrollToTasks();
      return;
    }

    const beforeDistinct = countDistinctCards(
      state.cardCounts,
      CARD_DEFINITIONS,
    );
    const { card, isNew } = pickWeightedCard(state, CARD_DEFINITIONS);
    drawPendingRef.current = true;
    setIsDrawing(true);

    drawTimerRef.current = setTimeout(() => {
      const nextCounts = {
        ...state.cardCounts,
        [card.id]: (state.cardCounts[card.id] ?? 0) + 1,
      };
      const afterDistinct = countDistinctCards(nextCounts, CARD_DEFINITIONS);
      const newlyUnlocked = TIERS.filter(
        (tier) =>
          beforeDistinct < tier.threshold && afterDistinct >= tier.threshold,
      ).map((tier) => tier.id);

      setState((current) => ({
        ...current,
        drawBalance: Math.max(0, current.drawBalance - 1),
        duplicateStreak: isNew ? 0 : current.duplicateStreak + 1,
        cardCounts: {
          ...current.cardCounts,
          [card.id]: (current.cardCounts[card.id] ?? 0) + 1,
        },
      }));
      setDrawResult({ cardId: card.id, isNew, newlyUnlocked });
      drawPendingRef.current = false;
      setIsDrawing(false);
    }, 1050);
  }

  function completeTask(task: TaskDefinition) {
    const taskLockKey = `${theme.id}:${task.id}`;
    const operationEpoch = stateEpochRef.current;
    if (task.id === "browse") {
      announce("今日浏览奖励已经到账");
      return;
    }
    if (task.id === "gift") {
      setActiveModal("cards");
      return;
    }

    const progress = state.taskProgress[task.id] ?? 0;
    if (pendingTaskIdsRef.current.has(taskLockKey)) return;
    if (progress >= task.target) {
      announce("这项任务已经完成");
      return;
    }

    pendingTaskIdsRef.current.add(taskLockKey);
    const finish = () => {
      if (operationEpoch !== stateEpochRef.current) {
        pendingTaskIdsRef.current.delete(taskLockKey);
        return;
      }
      setState((current) => ({
        ...current,
        drawBalance: current.drawBalance + task.reward,
        taskProgress: {
          ...current.taskProgress,
          [task.id]: Math.min(
            task.target,
            (current.taskProgress[task.id] ?? 0) + 1,
          ),
        },
      }));
      announce(`任务完成，获得${task.reward}次抽${theme.cardNoun}机会`);
      window.setTimeout(() => {
        pendingTaskIdsRef.current.delete(taskLockKey);
      }, 300);
    };

    if (theme.id === "night" && task.id === "share") {
      const clipboardWrite =
        navigator.clipboard?.writeText?.(window.location.href);
      if (clipboardWrite) {
        clipboardWrite.catch(() => undefined).finally(finish);
      } else {
        finish();
      }
      return;
    }

    finish();
  }

  function claimTier(tier: TierDefinition) {
    const unlocked = uniqueCount >= tier.threshold;
    const claimed = state.claimedTiers.includes(tier.id);
    const tierLockKey = `${theme.id}:${tier.id}`;

    if (!unlocked) {
      announce(`还差${tier.threshold - uniqueCount}种卡即可解锁`);
      return;
    }
    if (claimed) {
      setActiveModal("prizes");
      return;
    }
    if (claimedTierIdsRef.current.has(tierLockKey)) return;
    claimedTierIdsRef.current.add(tierLockKey);

    const coupon: Coupon = {
      id: tier.id,
      tierId: tier.id,
      title: tier.title,
      amount: tier.amount,
      condition: tier.condition,
      expiresAt: "2026.08.31",
      status: "unused",
    };
    setState((current) => ({
      ...current,
      claimedTiers: [...current.claimedTiers, tier.id],
      coupons: [...current.coupons, coupon],
    }));
    announce(
      tier.kind === "coupon"
        ? `${tier.amount}元优惠券已放入“我的奖品”`
        : "终极纪念礼抽签码已领取",
    );
  }

  function markCouponUsed(couponId: string) {
    setState((current) => ({
      ...current,
      coupons: current.coupons.map((coupon) =>
        coupon.id === couponId ? { ...coupon, status: "used" } : coupon,
      ),
    }));
    announce("演示核销成功");
  }

  function beginGift(cardId: string) {
    if ((state.cardCounts[cardId] ?? 0) <= 1) {
      announce("需要抽到重复卡后才能赠送");
      return;
    }
    setActiveModal(null);
    setDrawResult(null);
    setGiftShared(false);
    giftClaimPendingRef.current = false;
    setGiftCardId(cardId);
  }

  function createGiftLink() {
    const card = CARD_DEFINITIONS.find((item) => item.id === giftCardId);
    if (!card) return;
    const link = `${window.location.origin}/?theme=${theme.id}&gift=${card.id}`;
    navigator.clipboard?.writeText(link).catch(() => undefined);
    setGiftShared(true);
    announce("赠卡链接已复制，演示中可直接模拟好友领取");
  }

  function simulateGiftClaim() {
    if (!giftCardId || !giftShared || giftClaimPendingRef.current) return;
    const cardCount = state.cardCounts[giftCardId] ?? 0;
    if (cardCount <= 1) {
      announce("重复卡数量不足");
      setGiftCardId(null);
      return;
    }

    const currentProgress = state.taskProgress.gift;
    const canReward = currentProgress < 3;
    giftClaimPendingRef.current = true;
    setState((current) => ({
      ...current,
      drawBalance: current.drawBalance + (canReward ? 1 : 0),
      cardCounts: {
        ...current.cardCounts,
        [giftCardId]: Math.max(1, (current.cardCounts[giftCardId] ?? 1) - 1),
      },
      taskProgress: {
        ...current.taskProgress,
        gift: Math.min(3, current.taskProgress.gift + 1),
      },
    }));
    setGiftCardId(null);
    setGiftShared(false);
    announce(
      canReward
        ? "好友已领取，你获得1次抽卡机会"
        : "好友已领取，本期赠卡奖励已达上限",
    );
  }

  function resetExperience() {
    if (!resetArmed) {
      setResetArmed(true);
      announce("再点一次确认重置体验数据");
      return;
    }
    stateEpochRef.current += 1;
    if (drawTimerRef.current) {
      clearTimeout(drawTimerRef.current);
      drawTimerRef.current = null;
    }
    setCampaignState(createInitialState());
    setIsDrawing(false);
    drawPendingRef.current = false;
    pendingTaskIdsRef.current.clear();
    claimedTierIdsRef.current.clear();
    giftClaimPendingRef.current = false;
    setResetArmed(false);
    setActiveModal(null);
    setDrawResult(null);
    setGiftCardId(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    announce("体验数据已重置");
  }

  const resultCard = drawResult
    ? CARD_DEFINITIONS.find((card) => card.id === drawResult.cardId)
    : null;
  const giftCard = giftCardId
    ? CARD_DEFINITIONS.find((card) => card.id === giftCardId)
    : null;
  const heroTier =
    [...TIERS]
      .reverse()
      .find((tier) => uniqueCount >= tier.threshold)?.threshold ?? 0;
  const collectedHeroCards = CARD_DEFINITIONS.filter(
    (card) => (state.cardCounts[card.id] ?? 0) > 0,
  ).slice(-5);

  function renderTaskCard(
    task: TaskDefinition,
    variant: "featured" | "compact" | "default",
  ) {
    const progress = state.taskProgress[task.id] ?? 0;
    const complete = progress >= task.target;
    const duplicates = CARD_DEFINITIONS.some(
      (card) => (state.cardCounts[card.id] ?? 0) > 1,
    );
    const disabled =
      task.id === "browse"
        ? true
        : complete && !task.repeatable
          ? true
          : task.id === "gift" && !duplicates;
    const actionLabel =
      task.id === "gift" && !duplicates
        ? "暂无重复卡"
        : complete && !task.repeatable
          ? task.action
          : complete
            ? "已达上限"
            : task.action;

    return (
      <article className={`task-card task-card-${variant}`} key={task.id}>
        <div className="task-icon" aria-hidden="true">
          {task.icon}
        </div>
        <div className="task-copy">
          <div className="task-title-row">
            <h3>{task.title}</h3>
            <span>
              {progress}/{task.target}
            </span>
          </div>
          <p>{task.description}</p>
          <div className="task-progress" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, (progress / task.target) * 100)}%`,
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => completeTask(task)}
          disabled={disabled}
          aria-label={`${task.title}，${complete ? "已完成" : task.action}`}
        >
          {actionLabel}
        </button>
      </article>
    );
  }

  return (
    <main className={`campaign-shell theme-${theme.id}`}>
      {theme.id === "summer" && (
        <div className="summer-map-cap" aria-hidden="true">
          <img src="/figma/crops/map-cap.png" alt="" decoding="async" />
        </div>
      )}
      <section
        className={`hero hero-${theme.heroMode}`}
        aria-labelledby="campaign-title"
        data-tier={heroTier}
      >
        <h1 id="campaign-title" className="sr-only">
          {theme.accessibleTitle}
        </h1>
        <picture className="hero-media">
          <img
            src={theme.heroImage}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="hero-progress-visual" aria-hidden="true">
          {collectedHeroCards.map((card, index) => (
            <span
              className={`hero-collected-card hero-collected-card-${index} ${
                drawResult?.cardId === card.id ? "recent" : ""
              }`}
              key={card.id}
              style={{ "--card-accent": card.accent } as React.CSSProperties}
            >
              <CardArtwork card={card} />
            </span>
          ))}
        </div>
        {theme.id === "night" && (
          <div className="hero-topline">
            <span className="prototype-chip">交互原型 · 本地模拟</span>
          </div>
        )}

        {theme.id === "summer" ? (
          <nav className="stage-nav summer-stage-hotspots" aria-label="活动主题">
            <button
              type="button"
              className="active"
              onClick={() => announce("当前已是夏天马上顺主题")}
              aria-pressed="true"
            >
              夏天马上顺
            </button>
            <button
              type="button"
              className="locked"
              onClick={() => switchTheme("night")}
              aria-label="切换至夏日夜食指南主题"
            >
              敬请期待
            </button>
          </nav>
        ) : (
          <nav className="stage-nav" aria-label="活动主题">
            <button
              type="button"
              onClick={() => switchTheme("summer")}
              aria-pressed="false"
            >
              夏天马上顺
            </button>
            <button
              type="button"
              className="active"
              onClick={() => switchTheme("night")}
              aria-pressed="true"
            >
              夏日夜食指南
            </button>
            <button type="button" className="locked" disabled>
              敬请期待
            </button>
          </nav>
        )}

        <div className="hero-actions">
          <button
            type="button"
            className="side-action left"
            onClick={() => setActiveModal("cards")}
          >
            我的
            <br />
            {theme.id === "summer" ? "装备" : "卡册"}
          </button>
          <button
            type="button"
            className={`draw-button ${isDrawing ? "drawing" : ""}`}
            onClick={handleDraw}
            disabled={!ready || isDrawing}
            aria-label={`${theme.drawCta}，剩余${state.drawBalance}次`}
            data-testid="draw-button"
          >
            <span className="draw-button-glow" aria-hidden="true" />
            <span>{isDrawing ? `正在抽${theme.cardNoun}…` : theme.drawCta}</span>
            <b>{state.drawBalance}</b>
          </button>
          <button
            type="button"
            className="side-action right"
            onClick={() => setActiveModal("prizes")}
          >
            我的
            <br />
            奖品
          </button>
        </div>

        <div className="floating-actions">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .catch(() => undefined);
              announce("活动链接已复制");
            }}
          >
            分享
          </button>
          <button type="button" onClick={() => setActiveModal("rules")}>
            规则
          </button>
        </div>
      </section>

      <section className="collection-panel" aria-labelledby="collection-title">
        <div className="collection-heading">
          <div>
            <span>{theme.collectionName}</span>
            <h2 id="collection-title">
              {uniqueCount === 9
                ? "全套集齐，好运圆满"
                : `${theme.id === "summer" ? "再抽" : "再集"} ${Math.max(
                    0,
                    nextTier.threshold - uniqueCount,
                  )} 种`}
            </h2>
            <p>
              {uniqueCount === 9
                ? "终极纪念礼已解锁"
                : theme.id === "summer"
                  ? `兑${nextTier.amount}元顺顺券`
                  : `解锁${nextTier.title}`}
            </p>
          </div>
          <div className="collection-count">
            <strong>{uniqueCount}</strong>
            <span>/ {CARD_DEFINITIONS.length}</span>
          </div>
        </div>

        <div className="progress-track" aria-label={`已集齐${uniqueCount}种卡`}>
          <span
            style={{
              width: `${(uniqueCount / CARD_DEFINITIONS.length) * 100}%`,
            }}
          />
        </div>

        <div className="tier-row">
          {TIERS.map((tier) => {
            const unlocked = uniqueCount >= tier.threshold;
            const claimed = state.claimedTiers.includes(tier.id);
            return (
              <button
                type="button"
                className={`tier ${unlocked ? "unlocked" : ""} ${
                  claimed ? "claimed" : ""
                }`}
                key={tier.id}
                onClick={() => claimTier(tier)}
                aria-label={`${tier.threshold}种卡奖励：${tier.title}，${
                  claimed ? "已领取" : unlocked ? "可领取" : "未解锁"
                }`}
              >
                <span className="tier-ticket">
                  {theme.id === "summer" && tier.kind === "grand" ? (
                    <img
                      className="tier-prize-image"
                      src="/figma/reward-gold-horse.webp"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    tier.icon
                  )}
                </span>
                <b>{tier.threshold}种</b>
                <small>
                  {claimed ? "已领取" : unlocked ? "点击领取" : "未解锁"}
                </small>
              </button>
            );
          })}
        </div>

        <div className="card-scroller">
          {CARD_DEFINITIONS.map((card) => {
            const count = state.cardCounts[card.id] ?? 0;
            const owned = count > 0;
            return (
              <button
                type="button"
                className={`food-card ${owned ? "owned" : "missing"}`}
                key={card.id}
                style={{ "--card-accent": card.accent } as React.CSSProperties}
                onClick={() => {
                  setActiveModal("cards");
                  if (count > 1) announce(`${card.name}有${count - 1}张可赠送`);
                }}
                aria-label={`${card.name}，${owned ? `已有${count}张` : "未获得"}`}
              >
                {count > 1 && <span className="card-count">×{count}</span>}
                <span className="card-emoji" aria-hidden="true">
                  <CardArtwork card={card} visible={owned} />
                </span>
                <b>{owned ? card.name : "等待点亮"}</b>
                <small>
                  {owned
                    ? card.rarity
                    : theme.id === "summer"
                      ? "神秘装备"
                      : "神秘夜味"}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="energy-teaser" aria-label="金豆副玩法预告">
        <div className="bean-orbit" aria-hidden="true">
          {theme.id === "summer" ? (
            <img
              src="/figma/mascot-side-horse.webp"
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <>
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </>
          )}
        </div>
        <div>
          <small>{theme.id === "summer" ? "金豆副玩法" : "副玩法预告"}</small>
          <h2>
            {theme.id === "summer"
              ? "冲浪得金豆，好礼兑不停"
              : `接金豆，${theme.rewardVerb}`}
          </h2>
          <p>
            {theme.id === "summer"
              ? "已有99999🟡，冲一冲兑50元券 ›"
              : "攒体力玩法即将开放"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => announce("副玩法将在第二版开放")}
        >
          {theme.id === "summer" ? (
            <>
              冲!<b>1</b>
            </>
          ) : (
            "预告"
          )}
        </button>
      </section>

      <section
        className="tasks-section"
        ref={taskSectionRef}
        aria-labelledby="tasks-title"
      >
        <div className="section-kicker">
          <span>每天0点刷新</span>
          <p>PLAY · EARN · COLLECT</p>
        </div>
        <h2 id="tasks-title">
          {theme.tasksTitle}
        </h2>

        <div className="task-tabs" role="tablist" aria-label="任务类型">
          <button
            type="button"
            className={taskTab === "draw" ? "active" : ""}
            onClick={() => setTaskTab("draw")}
            role="tab"
            aria-selected={taskTab === "draw"}
          >
            {theme.drawTabLabel}
          </button>
          <button
            type="button"
            className={taskTab === "energy" ? "active" : ""}
            onClick={() => setTaskTab("energy")}
            role="tab"
            aria-selected={taskTab === "energy"}
          >
            {theme.energyTabLabel} · 预告
          </button>
        </div>

        {taskTab === "draw" ? (
          theme.id === "summer" ? (
            <>
              <div className="featured-task-rail">
                {TASKS.slice(0, 2).map((task) =>
                  renderTaskCard(task, "featured"),
                )}
              </div>
              <div className="task-list task-list-compact">
                {[TASKS[2], TASKS[0], TASKS[3], TASKS[4]].map((task) =>
                  renderTaskCard(task, "compact"),
                )}
              </div>
            </>
          ) : (
            <div className="task-list">
              {TASKS.map((task) => renderTaskCard(task, "default"))}
            </div>
          )
        ) : (
          <div className="coming-card">
            <div className="coming-visual" aria-hidden="true">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </div>
            <h3>接金豆副玩法正在准备</h3>
            <p>
              后续可接入“任务得体力—小游戏接豆—金豆兑券”的独立循环。
            </p>
            <button type="button" onClick={() => setTaskTab("draw")}>
              先去{theme.drawTabLabel}
            </button>
          </div>
        )}
      </section>

      <div className="campaign-content-world">
      <section className="topics-section" aria-labelledby="topics-title">
        <p>{theme.topicEyebrow}</p>
        <h2 id="topics-title">{theme.topicTitle}</h2>
        <div className="topic-chips">
          {theme.topicChips.map((chip, index) => (
            <span key={`${chip}-${index}`}>{chip}</span>
          ))}
        </div>
        <div className="inspiration-grid">
          {theme.inspirationCards.map((item, index) => {
            const task = TASKS.find((candidate) => candidate.id === item.taskId);
            return (
              <article
                className={`inspiration-card inspiration-card-${index + 1}`}
                key={item.title}
              >
                <div className="inspiration-media" aria-hidden="true">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    item.emoji
                  )}
                </div>
                <span>{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <button
                  type="button"
                  onClick={() => task && completeTask(task)}
                  disabled={!task}
                >
                  {item.taskId === "post" ? "发布同款灵感" : "去发现更多"} →
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {theme.id === "summer" && (
        <section
          className="discovery-section"
          aria-labelledby="discovery-title"
        >
          <div className="discovery-heading">
            <small>热门投稿　 HOT!!　🔥</small>
            <h2 id="discovery-title">扎进水里夏天（马上顺）</h2>
          </div>
          <div className="venue-grid">
            {SUMMER_VENUES.map((venue, index) => (
              <article className="venue-card" key={`${venue.location}-${index}`}>
                <div className="venue-media">
                  <img
                    src={venue.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>⌖ {venue.location}</span>
                </div>
                <h3>{venue.title}</h3>
                <div className="venue-meta">
                  <img
                    className="venue-avatar"
                    src="/figma/content-avatar.png"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>小九兄弟</span>
                  <span>♡ 92.4万</span>
                </div>
                <button
                  type="button"
                  onClick={() => announce(`已打开${venue.location}灵感`)}
                  aria-label={`查看${venue.location}：${venue.title}`}
                />
              </article>
            ))}
          </div>
          <button
            className="more-activities"
            type="button"
            onClick={() => announce("更多精彩活动即将上线")}
          >
            更多精彩活动
          </button>
          <button
            className="campaign-banner-slot"
            type="button"
            onClick={() => announce("品牌联合活动位")}
            aria-label="品牌联合活动"
          />
        </section>
      )}
      </div>

      <footer className={theme.id === "summer" ? "summer-footer" : ""}>
        {theme.id === "summer" ? (
          <>
            <img
              className="brand-logo"
              src="/figma/crops/brand-logo.png"
              alt="抖音生活服务，让每次心动都值得"
              loading="lazy"
              decoding="async"
            />
            <button
              className="footer-rules-entry"
              type="button"
              onClick={() => setActiveModal("rules")}
            >
              玩法与演示说明
            </button>
          </>
        ) : (
          <>
            <div className="footer-mark">{theme.navLabel}</div>
            <p>本页面为活动机制交互原型，优惠券与任务均为本地模拟。</p>
            <button type="button" onClick={() => setActiveModal("rules")}>
              查看玩法与演示说明
            </button>
          </>
        )}
      </footer>

      {drawResult && resultCard && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="draw-result-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setDrawResult(null)}
              aria-label="关闭抽卡结果"
            >
              ×
            </button>
            <p className="result-kicker">
              {drawResult.isNew
                ? "NEW COLLECTION!"
                : `熟悉的${theme.cardNoun}又来了`}
            </p>
            <div
              className="result-card-art"
              style={{ "--card-accent": resultCard.accent } as React.CSSProperties}
            >
              <span>
                <CardArtwork card={resultCard} />
              </span>
              <small>{resultCard.rarity}</small>
            </div>
            <h2 id="draw-result-title">{resultCard.name}</h2>
            <p>
              {drawResult.isNew
                ? `新卡已点亮，当前集齐${uniqueCount}/${CARD_DEFINITIONS.length}种`
                : `重复卡×${state.cardCounts[resultCard.id] ?? 1}，可赠送给朋友`}
            </p>
            {drawResult.newlyUnlocked.length > 0 && (
              <div className="unlock-banner">
                🎉 新档位已解锁，回到卡册领取奖励
              </div>
            )}
            <div className="modal-actions">
              {!drawResult.isNew &&
                (state.cardCounts[resultCard.id] ?? 0) > 1 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => beginGift(resultCard.id)}
                  >
                    赠送重复卡
                  </button>
                )}
              <button
                type="button"
                className="primary"
                onClick={() => setDrawResult(null)}
              >
                收下这张卡
              </button>
            </div>
          </section>
        </div>
      )}

      {activeModal === "cards" && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="sheet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cards-modal-title"
          >
            <div className="sheet-handle" />
            <button
              type="button"
              className="modal-close"
              onClick={() => setActiveModal(null)}
              aria-label="关闭我的卡册"
            >
              ×
            </button>
            <p className="sheet-kicker">MY COLLECTION</p>
            <h2 id="cards-modal-title">我的{theme.collectionName}</h2>
            <p className="sheet-summary">
              已点亮{uniqueCount}种 · 重复卡可赠送，历史进度不会倒退
            </p>
            <div className="album-grid">
              {CARD_DEFINITIONS.map((card) => {
                const count = state.cardCounts[card.id] ?? 0;
                return (
                  <article
                    className={`album-card ${count > 0 ? "owned" : ""}`}
                    key={card.id}
                    style={{ "--card-accent": card.accent } as React.CSSProperties}
                  >
                    <span>
                      <CardArtwork card={card} visible={count > 0} />
                    </span>
                    <h3>
                      {count > 0
                        ? card.name
                        : theme.id === "summer"
                          ? "神秘装备"
                          : "神秘夜味"}
                    </h3>
                    <small>{count > 0 ? `已有${count}张` : "尚未获得"}</small>
                    <button
                      type="button"
                      onClick={() => beginGift(card.id)}
                      disabled={count <= 1}
                    >
                      {count > 1 ? `赠送多余${count - 1}张` : "暂无可赠"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeModal === "prizes" && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="sheet-modal prizes-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prizes-modal-title"
          >
            <div className="sheet-handle" />
            <button
              type="button"
              className="modal-close"
              onClick={() => setActiveModal(null)}
              aria-label="关闭我的奖品"
            >
              ×
            </button>
            <p className="sheet-kicker">MY REWARDS</p>
            <h2 id="prizes-modal-title">我的奖品</h2>
            <p className="sheet-summary">演示券仅用于体验，不具备真实核销能力</p>
            {state.coupons.length === 0 ? (
              <div className="empty-prizes">
                <span>🎟️</span>
                <h3>还没有奖品</h3>
                <p>
                  集齐{TIERS[0].threshold}种卡即可领取第一份奖励。
                </p>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                >
                  去抽一张
                </button>
              </div>
            ) : (
              <div className="coupon-list">
                {state.coupons.map((coupon) => (
                  <article
                    className={`coupon ${coupon.status === "used" ? "used" : ""}`}
                    key={coupon.id}
                  >
                    <div className="coupon-value">
                      {coupon.tierId === "tier-9" ? (
                        <strong>{TIERS.at(-1)?.icon ?? "限定礼"}</strong>
                      ) : (
                        <>
                          <small>¥</small>
                          <strong>{coupon.amount}</strong>
                        </>
                      )}
                    </div>
                    <div className="coupon-copy">
                      <h3>{coupon.title}</h3>
                      <p>{coupon.condition}</p>
                      <small>有效期至 {coupon.expiresAt}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => markCouponUsed(coupon.id)}
                      disabled={coupon.status === "used"}
                    >
                      {coupon.status === "used" ? "已使用" : "模拟使用"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeModal === "rules" && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="sheet-modal rules-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-modal-title"
          >
            <div className="sheet-handle" />
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setActiveModal(null);
                setResetArmed(false);
              }}
              aria-label="关闭活动规则"
            >
              ×
            </button>
            <p className="sheet-kicker">HOW IT WORKS</p>
            <h2 id="rules-modal-title">玩法与演示说明</h2>
            <ol className="rules-list">
              <li>
                <b>做任务</b>
                <span>
                  完成下方模拟任务，抽{theme.cardNoun}次数会自动到账。
                </span>
              </li>
              <li>
                <b>抽{theme.cardNoun}</b>
                <span>每次消耗1次机会，随机获得9种卡之一。</span>
              </li>
              <li>
                <b>集卡领奖</b>
                <span>
                  历史集齐
                  {TIERS.filter((tier) => tier.kind === "coupon")
                    .map((tier) => tier.threshold)
                    .join("、")}
                  种可累计领取不同面额优惠券。
                </span>
              </li>
              <li>
                <b>赠送重复卡</b>
                <span>只允许赠送多余卡；模拟好友领取后再奖励1次抽卡。</span>
              </li>
            </ol>
            <div className="demo-notice">
              当前是前端交互原型：任务、好友领取、优惠券核销与概率均在本设备本地模拟。
            </div>
            <button
              type="button"
              className={`reset-button ${resetArmed ? "armed" : ""}`}
              onClick={resetExperience}
            >
              {resetArmed ? "确认重置全部体验数据" : "重置体验数据"}
            </button>
          </section>
        </div>
      )}

      {giftCard && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="gift-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-modal-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setGiftCardId(null);
                setGiftShared(false);
              }}
              aria-label="关闭赠卡"
            >
              ×
            </button>
            <div
              className="gift-card-visual"
              style={{ "--card-accent": giftCard.accent } as React.CSSProperties}
            >
              <span>
                <CardArtwork card={giftCard} />
              </span>
            </div>
            <p className="result-kicker">PASS THE FLAVOR</p>
            <h2 id="gift-modal-title">把「{giftCard.name}」送给朋友</h2>
            <p>
              当前共有{state.cardCounts[giftCard.id] ?? 0}
              张；赠出后会保留至少1张，集卡进度不倒退。
            </p>
            {!giftShared ? (
              <button type="button" className="primary" onClick={createGiftLink}>
                生成并复制赠卡链接
              </button>
            ) : (
              <>
                <div className="gift-link-status">✓ 赠卡链接已生成</div>
                <button
                  type="button"
                  className="primary"
                  onClick={simulateGiftClaim}
                >
                  模拟好友已领取
                </button>
              </>
            )}
            <small className="gift-disclaimer">
              真实跨账号赠卡需要服务端一次性领取凭证；本原型仅模拟状态流转。
            </small>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
