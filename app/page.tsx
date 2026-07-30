"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CardDefinition = {
  id: string;
  name: string;
  emoji: string;
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

type CampaignState = {
  version: number;
  drawBalance: number;
  duplicateStreak: number;
  cardCounts: Record<string, number>;
  taskProgress: Record<TaskId, number>;
  claimedTiers: string[];
  coupons: Coupon[];
};

type DrawResult = {
  cardId: string;
  isNew: boolean;
  newlyUnlocked: string[];
};

const STORAGE_KEY = "night-bites-campaign-v1";

const CARD_DEFINITIONS: CardDefinition[] = [
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

const TIERS: TierDefinition[] = [
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

const TASKS: TaskDefinition[] = [
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

const INITIAL_STATE: CampaignState = {
  version: 1,
  drawBalance: 1,
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

function countDistinctCards(cardCounts: Record<string, number>) {
  return CARD_DEFINITIONS.filter((card) => (cardCounts[card.id] ?? 0) > 0)
    .length;
}

function normalizeState(input: unknown): CampaignState {
  if (!input || typeof input !== "object") return INITIAL_STATE;
  const candidate = input as Partial<CampaignState>;
  const cardCounts = Object.fromEntries(
    CARD_DEFINITIONS.map((card) => [
      card.id,
      Math.max(0, Number(candidate.cardCounts?.[card.id]) || 0),
    ]),
  );
  const taskProgress = Object.fromEntries(
    TASKS.map((task) => [
      task.id,
      Math.min(
        task.target,
        Math.max(0, Number(candidate.taskProgress?.[task.id]) || 0),
      ),
    ]),
  ) as Record<TaskId, number>;

  return {
    version: 1,
    drawBalance: Math.max(0, Number(candidate.drawBalance) || 0),
    duplicateStreak: Math.max(0, Number(candidate.duplicateStreak) || 0),
    cardCounts,
    taskProgress,
    claimedTiers: Array.isArray(candidate.claimedTiers)
      ? candidate.claimedTiers.filter((id) =>
          TIERS.some((tier) => tier.id === id),
        )
      : [],
    coupons: Array.isArray(candidate.coupons)
      ? candidate.coupons.filter(
          (coupon): coupon is Coupon =>
            Boolean(
              coupon &&
                typeof coupon.id === "string" &&
                typeof coupon.tierId === "string",
            ),
        )
      : [],
  };
}

function pickWeightedCard(
  state: CampaignState,
): { card: CardDefinition; isNew: boolean } {
  const unowned = CARD_DEFINITIONS.filter(
    (card) => (state.cardCounts[card.id] ?? 0) === 0,
  );
  const shouldFavorNew =
    unowned.length > 0 &&
    (state.duplicateStreak >= 2 || Math.random() < 0.72);
  const pool = shouldFavorNew ? unowned : CARD_DEFINITIONS;
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
  const [state, setState] = useState<CampaignState>(INITIAL_STATE);
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

  const uniqueCount = useMemo(
    () => countDistinctCards(state.cardCounts),
    [state.cardCounts],
  );
  const nextTier =
    TIERS.find((tier) => uniqueCount < tier.threshold) ?? TIERS[TIERS.length - 1];

  useEffect(() => {
    const hydrateFromStorage = () => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setState(normalizeState(JSON.parse(saved)));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setReady(true);
      }
    };
    window.queueMicrotask(hydrateFromStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The demo stays usable even if browser storage is unavailable.
    }
  }, [ready, state]);

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

  function handleDraw() {
    if (!ready || isDrawing) return;
    if (state.drawBalance <= 0) {
      announce("抽卡机会用完啦，完成任务可以继续抽");
      scrollToTasks();
      return;
    }

    const beforeDistinct = countDistinctCards(state.cardCounts);
    const { card, isNew } = pickWeightedCard(state);
    setIsDrawing(true);

    drawTimerRef.current = setTimeout(() => {
      const nextCounts = {
        ...state.cardCounts,
        [card.id]: (state.cardCounts[card.id] ?? 0) + 1,
      };
      const afterDistinct = countDistinctCards(nextCounts);
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
      setIsDrawing(false);
    }, 1050);
  }

  function completeTask(task: TaskDefinition) {
    if (task.id === "browse") {
      announce("今日浏览奖励已经到账");
      return;
    }
    if (task.id === "gift") {
      setActiveModal("cards");
      return;
    }

    const progress = state.taskProgress[task.id] ?? 0;
    if (progress >= task.target) {
      announce("这项任务已经完成");
      return;
    }

    const finish = () => {
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
      announce(`任务完成，获得${task.reward}次抽卡机会`);
    };

    if (task.id === "share") {
      navigator.clipboard
        ?.writeText(window.location.href)
        .catch(() => undefined)
        .finally(finish);
      return;
    }

    finish();
  }

  function claimTier(tier: TierDefinition) {
    const unlocked = uniqueCount >= tier.threshold;
    const claimed = state.claimedTiers.includes(tier.id);

    if (!unlocked) {
      announce(`还差${tier.threshold - uniqueCount}种卡即可解锁`);
      return;
    }
    if (claimed) {
      setActiveModal("prizes");
      return;
    }

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
    setGiftCardId(cardId);
  }

  function createGiftLink() {
    const card = CARD_DEFINITIONS.find((item) => item.id === giftCardId);
    if (!card) return;
    const link = `${window.location.origin}/?gift=${card.id}`;
    navigator.clipboard?.writeText(link).catch(() => undefined);
    setGiftShared(true);
    announce("赠卡链接已复制，演示中可直接模拟好友领取");
  }

  function simulateGiftClaim() {
    if (!giftCardId || !giftShared) return;
    const cardCount = state.cardCounts[giftCardId] ?? 0;
    if (cardCount <= 1) {
      announce("重复卡数量不足");
      setGiftCardId(null);
      return;
    }

    const currentProgress = state.taskProgress.gift;
    const canReward = currentProgress < 3;
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
    setState(INITIAL_STATE);
    setResetArmed(false);
    setActiveModal(null);
    setDrawResult(null);
    setGiftCardId(null);
    window.localStorage.removeItem(STORAGE_KEY);
    announce("体验数据已重置");
  }

  const resultCard = drawResult
    ? CARD_DEFINITIONS.find((card) => card.id === drawResult.cardId)
    : null;
  const giftCard = giftCardId
    ? CARD_DEFINITIONS.find((card) => card.id === giftCardId)
    : null;

  return (
    <main className="campaign-shell">
      <section className="hero" aria-labelledby="campaign-title">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-topline">
          <span className="date-chip">7.30—8.31</span>
          <span className="prototype-chip">交互原型 · 本地模拟</span>
        </div>
        <div className="hero-copy">
          <p>夏夜限定 · 九味收藏计划</p>
          <h1 id="campaign-title">
            今晚<span>开饭</span>
          </h1>
          <strong>集齐夜宵好味，赢夏夜好券</strong>
        </div>

        <nav className="stage-nav" aria-label="活动阶段">
          <span>开饭预告</span>
          <span className="active">九味卡册</span>
          <span className="locked">终极夜宴 · 敬请期待</span>
        </nav>

        <div className="hero-actions">
          <button
            type="button"
            className="side-action left"
            onClick={() => setActiveModal("cards")}
          >
            我的
            <br />
            卡册
          </button>
          <button
            type="button"
            className={`draw-button ${isDrawing ? "drawing" : ""}`}
            onClick={handleDraw}
            disabled={!ready || isDrawing}
            aria-label={`抽一张夜宵卡，剩余${state.drawBalance}次`}
            data-testid="draw-button"
          >
            <span className="draw-button-glow" aria-hidden="true" />
            <span>{isDrawing ? "正在开卡…" : "抽一张夜宵卡"}</span>
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
            <span>九味卡册</span>
            <h2 id="collection-title">
              {uniqueCount === 9
                ? "全套集齐，今晚圆满"
                : `再集 ${Math.max(0, nextTier.threshold - uniqueCount)} 种`}
            </h2>
            <p>
              {uniqueCount === 9
                ? "终极纪念礼已解锁"
                : `解锁${nextTier.title}`}
            </p>
          </div>
          <div className="collection-count">
            <strong>{uniqueCount}</strong>
            <span>/ 9</span>
          </div>
        </div>

        <div className="progress-track" aria-label={`已集齐${uniqueCount}种卡`}>
          <span style={{ width: `${(uniqueCount / 9) * 100}%` }} />
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
                <span className="tier-ticket">{tier.icon}</span>
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
                  {owned ? card.emoji : "?"}
                </span>
                <b>{owned ? card.name : "等待点亮"}</b>
                <small>{owned ? card.rarity : "神秘夜味"}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="energy-teaser" aria-label="金豆副玩法预告">
        <div className="bean-orbit" aria-hidden="true">
          <span>●</span>
          <span>●</span>
          <span>●</span>
        </div>
        <div>
          <small>副玩法预告</small>
          <h2>接金豆，兑加餐券</h2>
          <p>攒体力玩法即将开放</p>
        </div>
        <button
          type="button"
          onClick={() => announce("副玩法将在第二版开放")}
        >
          预告
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
          玩一夏，<span>抽更多</span>
        </h2>

        <div className="task-tabs" role="tablist" aria-label="任务类型">
          <button
            type="button"
            className={taskTab === "draw" ? "active" : ""}
            onClick={() => setTaskTab("draw")}
            role="tab"
            aria-selected={taskTab === "draw"}
          >
            抽夜宵
          </button>
          <button
            type="button"
            className={taskTab === "energy" ? "active" : ""}
            onClick={() => setTaskTab("energy")}
            role="tab"
            aria-selected={taskTab === "energy"}
          >
            攒体力 · 预告
          </button>
        </div>

        {taskTab === "draw" ? (
          <div className="task-list">
            {TASKS.map((task) => {
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

              return (
                <article className="task-card" key={task.id}>
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
                    <div className="task-progress">
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
                    {task.id === "gift" && !duplicates
                      ? "暂无重复卡"
                      : complete && !task.repeatable
                        ? task.action
                        : complete
                          ? "已达上限"
                          : task.action}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="coming-card">
            <div className="coming-visual" aria-hidden="true">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </div>
            <h3>接金豆副玩法正在备餐</h3>
            <p>后续可接入“任务得体力—小游戏接豆—金豆兑3元券”的独立循环。</p>
            <button type="button" onClick={() => setTaskTab("draw")}>
              先去抽夜宵
            </button>
          </div>
        )}
      </section>

      <section className="topics-section" aria-labelledby="topics-title">
        <p>SUMMER NIGHT TOPICS</p>
        <h2 id="topics-title">
          暑期 <span>#灵感话题</span>
        </h2>
        <div className="topic-chips">
          <span># 趁热吃顿夏夜小火锅</span>
          <span># 我拍到了夏天的味道</span>
          <span># 下班后的第一口快乐</span>
        </div>
        <div className="inspiration-grid">
          <article className="inspiration-card hotpot">
            <div aria-hidden="true">🥘</div>
            <span>深夜沸腾指南</span>
            <h3>这口热气，最懂夏夜</h3>
            <button type="button" onClick={() => completeTask(TASKS[1])}>
              发布同款灵感 →
            </button>
          </article>
          <article className="inspiration-card street">
            <div aria-hidden="true">🍢</div>
            <span>街角烟火地图</span>
            <h3>把城市吃到发光</h3>
            <button type="button" onClick={() => completeTask(TASKS[3])}>
              去发现好店 →
            </button>
          </article>
        </div>
      </section>

      <footer>
        <div className="footer-mark">今晚开饭</div>
        <p>本页面为活动机制交互原型，优惠券与任务均为本地模拟。</p>
        <button type="button" onClick={() => setActiveModal("rules")}>
          查看玩法与演示说明
        </button>
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
              {drawResult.isNew ? "NEW FLAVOR!" : "熟悉的夜味又来了"}
            </p>
            <div
              className="result-card-art"
              style={{ "--card-accent": resultCard.accent } as React.CSSProperties}
            >
              <span>{resultCard.emoji}</span>
              <small>{resultCard.rarity}</small>
            </div>
            <h2 id="draw-result-title">{resultCard.name}</h2>
            <p>
              {drawResult.isNew
                ? `新卡已点亮，当前集齐${uniqueCount}/9种`
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
            <h2 id="cards-modal-title">我的九味卡册</h2>
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
                    <span>{count > 0 ? card.emoji : "?"}</span>
                    <h3>{count > 0 ? card.name : "神秘夜味"}</h3>
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
                <p>集齐2种卡即可领取第一张优惠券。</p>
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
                        <strong>金勺</strong>
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
                <span>完成下方模拟任务，抽卡次数会自动到账。</span>
              </li>
              <li>
                <b>抽夜宵卡</b>
                <span>每次消耗1次机会，随机获得9种卡之一。</span>
              </li>
              <li>
                <b>集卡领奖</b>
                <span>历史集齐2、4、7种可累计领取不同面额优惠券。</span>
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
              <span>{giftCard.emoji}</span>
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
