"use client";

import type { CSSProperties, ReactNode } from "react";
import type {
  CampaignCollectionHeroLayer,
  CampaignHeroMedia,
  CampaignThemePack,
  ThemeId,
} from "./campaign-theme-packs";

type ThemeTab = {
  id: ThemeId;
  label: string;
};

export type StageTier = {
  id: string;
  threshold: number;
  title: string;
  statusLabel: string;
  unlocked: boolean;
  claimed: boolean;
  visual: ReactNode;
};

export type StageCard = {
  id: string;
  name: string;
  count: number;
  owned: boolean;
  rarity: string;
  missingLabel: string;
  accent: string;
  art: ReactNode;
};

type CampaignStageProps = {
  activeTheme: ThemeId;
  pack: CampaignThemePack;
  unlockedHeroCardIds: string[];
  unlockedCardCount: number;
  showHeroMeasurements?: boolean;
  tabs: ThemeTab[];
  accessibleTitle: string;
  heroTier: number;
  heroCards: ReactNode;
  collectionEntryLabel: string;
  drawLabel: string;
  drawingLabel: string;
  drawBalance: number;
  ready: boolean;
  isDrawing: boolean;
  collectionTitleId: string;
  collectionHeading: string;
  collectionSubheading: string;
  tiers: StageTier[];
  cards: StageCard[];
  heroTransition: {
    cardId: string;
    media: CampaignHeroMedia;
  } | null;
  onSwitchTheme: (themeId: ThemeId) => void;
  onOpenCollection: () => void;
  onDraw: () => void;
  onOpenPrizes: () => void;
  onShare: () => void;
  onOpenRules: () => void;
  onTierSelect: (tierId: string) => void;
  onCardSelect: (cardId: string) => void;
  onHeroTransitionEnd: () => void;
};

const HERO_DESIGN_WIDTH = 375;
const HERO_DESIGN_HEIGHT = 500;

function getHeroMediaMeasurement(media: CampaignHeroMedia) {
  const sourceWidth = media.sourceWidth;
  const sourceHeight = media.sourceHeight;
  const fit = media.fit ?? "cover";

  if (!sourceWidth || !sourceHeight) {
    return {
      sourceLabel: "素材尺寸未登记",
      renderLabel: `${fit} · ${media.position ?? "center"}`,
      edgeLabel: "按容器实时适配",
    };
  }

  const widthScale = HERO_DESIGN_WIDTH / sourceWidth;
  const heightScale = HERO_DESIGN_HEIGHT / sourceHeight;
  const scale =
    fit === "contain"
      ? Math.min(widthScale, heightScale)
      : Math.max(widthScale, heightScale);
  const renderedWidth = Math.round(sourceWidth * scale);
  const renderedHeight = Math.round(sourceHeight * scale);
  const verticalDelta = renderedHeight - HERO_DESIGN_HEIGHT;
  const edgeLabel =
    verticalDelta > 0
      ? `底部裁切 ${verticalDelta}px`
      : verticalDelta < 0
        ? `底部背景填充 ${Math.abs(verticalDelta)}px`
        : "高度完整贴合";

  return {
    sourceLabel: `素材 ${sourceWidth}×${sourceHeight}`,
    renderLabel: `渲染 ${renderedWidth}×${renderedHeight} · ${fit} · 顶对齐`,
    edgeLabel,
  };
}

function CampaignHeroMediaSlot({ media }: { media: CampaignHeroMedia }) {
  const mediaStyle: CSSProperties = {
    objectFit: media.fit ?? "cover",
    objectPosition: media.position ?? "center",
  };

  if (media.type === "video") {
    return (
      <video
        className="campaign-hero-media-content"
        src={media.src}
        poster={media.poster}
        style={mediaStyle}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
      />
    );
  }

  return (
    <img
      className="campaign-hero-media-content"
      src={media.src}
      alt=""
      style={mediaStyle}
      decoding="async"
      fetchPriority="high"
    />
  );
}

function CampaignHeroCardLayer({
  layer,
}: {
  layer: CampaignCollectionHeroLayer;
}) {
  if (!layer.media?.src || layer.embeddedInBase) return null;
  const style: CSSProperties = {
    left: `${(layer.x / HERO_DESIGN_WIDTH) * 100}%`,
    top: `${(layer.y / HERO_DESIGN_HEIGHT) * 100}%`,
    width: `${(layer.width / HERO_DESIGN_WIDTH) * 100}%`,
    zIndex: layer.zIndex,
    transform: `rotate(${layer.rotation}deg)`,
  };
  if (layer.media.type === "video") {
    return (
      <video
        className="campaign-hero-card-layer"
        src={layer.media.src}
        poster={layer.media.poster}
        style={style}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        data-card-id={layer.cardId}
      />
    );
  }
  return (
    <img
      className="campaign-hero-card-layer"
      src={layer.media.src}
      alt=""
      style={style}
      decoding="async"
      data-card-id={layer.cardId}
    />
  );
}

export function CampaignStage({
  activeTheme,
  pack,
  unlockedHeroCardIds,
  unlockedCardCount,
  showHeroMeasurements = false,
  tabs,
  accessibleTitle,
  heroTier,
  heroCards,
  collectionEntryLabel,
  drawLabel,
  drawingLabel,
  drawBalance,
  ready,
  isDrawing,
  collectionTitleId,
  collectionHeading,
  collectionSubheading,
  tiers,
  cards,
  heroTransition,
  onSwitchTheme,
  onOpenCollection,
  onDraw,
  onOpenPrizes,
  onShare,
  onOpenRules,
  onTierSelect,
  onCardSelect,
  onHeroTransitionEnd,
}: CampaignStageProps) {
  const collectionHeadingMatch = collectionHeading.match(
    /^(.*?)(\d+)(.*)$/,
  );
  const heroMediaMeasurement = getHeroMediaMeasurement(pack.assets.heroMedia);
  const transitionMediaStyle: CSSProperties = {
    objectFit: pack.assets.heroMedia.fit ?? "cover",
    objectPosition: pack.assets.heroMedia.position ?? "center top",
  };
  const heroComposition = pack.assets.collectionHeroComposition;
  const unlockedHeroCardIdSet = new Set(unlockedHeroCardIds);
  const visibleHeroLayers =
    heroComposition?.enabled
      ? heroComposition.layers
          .filter(
            (layer) =>
              unlockedHeroCardIdSet.has(layer.cardId) &&
              (layer.presentation ?? "image-layer") === "image-layer" &&
              !layer.embeddedInBase &&
              Boolean(layer.media?.src),
          )
          .sort((left, right) => left.zIndex - right.zIndex)
      : [];

  return (
    <section
      className="campaign-stage"
      aria-label="活动主舞台"
      data-testid="campaign-stage"
    >
      <div className="campaign-hero-stack">
        <div
          className={`campaign-map-layer ${
            pack.assets.mapBackgroundImage ? "has-art" : "is-plain"
          }`}
          aria-hidden="true"
        >
          {pack.assets.mapBackgroundImage && (
            <>
              <img
                className="campaign-map-art"
                src={pack.assets.mapBackgroundImage}
                alt=""
                decoding="async"
              />
              <img
                className="campaign-map-edge"
                src={pack.assets.mapBackgroundImage}
                alt=""
                decoding="async"
              />
            </>
          )}
          {showHeroMeasurements && (
            <div className="campaign-map-measurement">
              375 设计基准 · 地图层 375×78 · Hero 从 Y=78 开始
            </div>
          )}
        </div>

        <section
          className="hero campaign-hero campaign-hero-mask"
          aria-labelledby="campaign-title"
          data-tier={heroTier}
          data-unlocked-card-count={unlockedCardCount}
          data-visible-hero-layer-count={visibleHeroLayers.length}
          data-visible-hero-card-ids={visibleHeroLayers
            .map((layer) => layer.cardId)
            .join(",")}
        >
          <h1 id="campaign-title" className="sr-only">
            {accessibleTitle}
          </h1>

          <div
            className="hero-media campaign-hero-media campaign-hero-media-layer"
            aria-hidden="true"
          >
            <CampaignHeroMediaSlot media={pack.assets.heroMedia} />
            <div className="campaign-hero-card-layer-stack">
              {visibleHeroLayers.map((layer) => (
                <CampaignHeroCardLayer layer={layer} key={layer.id} />
              ))}
            </div>
          </div>

          <div
            className="campaign-hero-transition-layer"
            aria-hidden="true"
          />

          {heroTransition && (
            <div
              className="campaign-hero-unlock-transition"
              role="status"
              aria-label="道具点亮动画"
              data-testid="hero-unlock-transition"
              data-card-id={heroTransition.cardId}
            >
              {heroTransition.media.type === "video" ? (
                <video
                  src={heroTransition.media.src}
                  poster={heroTransition.media.poster}
                  style={transitionMediaStyle}
                  autoPlay
                  muted
                  playsInline
                  onEnded={onHeroTransitionEnd}
                  onError={onHeroTransitionEnd}
                />
              ) : (
                <img
                  src={heroTransition.media.src}
                  alt=""
                  style={transitionMediaStyle}
                  onLoad={() =>
                    window.setTimeout(onHeroTransitionEnd, 1200)
                  }
                />
              )}
              <button type="button" onClick={onHeroTransitionEnd}>
                跳过
              </button>
            </div>
          )}

          <div className="campaign-hero-effect-layer" aria-hidden="true">
            <div className="hero-progress-visual">{heroCards}</div>
          </div>

          <div className="campaign-hero-ui-layer">
            <nav
              className="stage-nav campaign-theme-tabs"
              aria-label="活动主题"
            >
              {tabs.map((tab) => (
                <button
                  type="button"
                  className={activeTheme === tab.id ? "active" : ""}
                  onClick={() => onSwitchTheme(tab.id)}
                  aria-pressed={activeTheme === tab.id}
                  data-testid={`theme-tab-${tab.id}`}
                  key={tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="hero-actions campaign-action-bar">
              <button
                type="button"
                className="side-action left"
                onClick={onOpenCollection}
              >
                我的
                <br />
                {collectionEntryLabel}
              </button>
              <button
                type="button"
                className={`draw-button ${isDrawing ? "drawing" : ""}`}
                onClick={onDraw}
                disabled={!ready || isDrawing}
                aria-label={`${drawLabel}，剩余${drawBalance}次`}
                data-testid="draw-button"
              >
                <span className="draw-button-glow" aria-hidden="true" />
                <span>{isDrawing ? drawingLabel : drawLabel}</span>
                <b data-testid="draw-balance">{drawBalance}</b>
              </button>
              <button
                type="button"
                className="side-action right"
                onClick={onOpenPrizes}
              >
                我的
                <br />
                奖品
              </button>
            </div>

            <div className="floating-actions">
              <button type="button" onClick={onShare}>
                分享
              </button>
              <button type="button" onClick={onOpenRules}>
                规则
              </button>
            </div>
          </div>

          {showHeroMeasurements && (
            <div
              className="campaign-hero-measurement-overlay"
              data-testid="hero-measurement-overlay"
              data-hero-ratio="375/500"
              data-transition-inset="65.2174%"
              data-reward-overlap="27px"
              aria-hidden="true"
            >
              <div className="hero-measure-frame" />
              <div className="hero-measure-width">
                <span>375</span>
              </div>
              <div className="hero-measure-height">
                <span>500</span>
              </div>
              <div className="hero-measure-radius">
                顶部圆角 R30（375 基准）
              </div>
              <div className="hero-measure-safe-zone">
                <span>关键内容安全区 375×375</span>
              </div>
              <div className="hero-measure-transition-zone">
                <span className="hero-measure-transition-start">
                  渐变 Mask 起点 · Y326 · Hero 65.22%
                </span>
                <span className="hero-measure-stop hero-measure-stop-18">
                  12% 页面色 · Y357
                </span>
                <span className="hero-measure-stop hero-measure-stop-52">
                  52% 页面色 · Y417
                </span>
                <span className="hero-measure-stop hero-measure-stop-80">
                  88% 页面色 · Y465
                </span>
                <span className="hero-measure-stop hero-measure-stop-100">
                  纯页面色 · Y500
                </span>
              </div>
              <div className="hero-measure-action-zone">
                <span>实时按钮层 · Y408–458 · 50px</span>
              </div>
              <div className="hero-measure-extension-zone">
                <span>背景延伸 · Y458–500 · 42px</span>
              </div>
              <dl className="hero-measure-info">
                <div>
                  <dt>标注基准</dt>
                  <dd>375px 设计画布</dd>
                </div>
                <div>
                  <dt>Hero 容器</dt>
                  <dd>375×500 · 3:4</dd>
                </div>
                <div>
                  <dt>图片源</dt>
                  <dd>{heroMediaMeasurement.sourceLabel}</dd>
                </div>
                <div>
                  <dt>填充方式</dt>
                  <dd>{heroMediaMeasurement.renderLabel}</dd>
                </div>
                <div>
                  <dt>底部结果</dt>
                  <dd>{heroMediaMeasurement.edgeLabel}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>

      <section
        className={`collection-panel campaign-reward-shelf${
          showHeroMeasurements ? " is-measured" : ""
        }`}
        aria-labelledby={collectionTitleId}
      >
        {showHeroMeasurements && (
          <div className="campaign-reward-overlap-measurement" aria-hidden="true">
            奖励卡片顶边：Hero Y433 · 向上叠入 27px
          </div>
        )}
        <div className="collection-heading">
          <div>
            <h2 id={collectionTitleId}>
              {collectionHeadingMatch ? (
                <>
                  {collectionHeadingMatch[1]}
                  <em>{collectionHeadingMatch[2]}</em>
                  {collectionHeadingMatch[3]}
                </>
              ) : (
                collectionHeading
              )}
            </h2>
            <p>{collectionSubheading}</p>
          </div>
        </div>

        <div className="tier-row">
          {tiers.map((tier) => (
            <button
              type="button"
              className={`tier ${tier.unlocked ? "unlocked" : ""} ${
                tier.claimed ? "claimed" : ""
              }`}
              onClick={() => onTierSelect(tier.id)}
              aria-label={`${tier.threshold}种卡奖励：${tier.title}，${tier.statusLabel}`}
              data-testid={`tier-${activeTheme}-${tier.id}`}
              key={tier.id}
            >
              <span className="tier-ticket">{tier.visual}</span>
              <b>{tier.threshold}种</b>
              <small>{tier.statusLabel}</small>
            </button>
          ))}
        </div>

        <div className="card-scroller">
          {cards.map((card) => (
            <button
              type="button"
              className={`food-card ${card.owned ? "owned" : "missing"}`}
              style={{ "--card-accent": card.accent } as CSSProperties}
              onClick={() => onCardSelect(card.id)}
              aria-label={`${card.name}，${
                card.owned ? `已有${card.count}张` : "未获得"
              }`}
              data-testid={`card-${activeTheme}-${card.id}`}
              key={card.id}
            >
              {card.count > 1 && (
                <span className="card-count">×{card.count}</span>
              )}
              <span className="card-emoji" aria-hidden="true">
                {card.art}
              </span>
              <b>{card.owned ? card.name : "等待点亮"}</b>
              <small>{card.owned ? card.rarity : card.missingLabel}</small>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
