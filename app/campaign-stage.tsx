"use client";

import type { CSSProperties, ReactNode } from "react";
import type {
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
  onSwitchTheme: (themeId: ThemeId) => void;
  onOpenCollection: () => void;
  onDraw: () => void;
  onOpenPrizes: () => void;
  onShare: () => void;
  onOpenRules: () => void;
  onTierSelect: (tierId: string) => void;
  onCardSelect: (cardId: string) => void;
};

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

export function CampaignStage({
  activeTheme,
  pack,
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
  onSwitchTheme,
  onOpenCollection,
  onDraw,
  onOpenPrizes,
  onShare,
  onOpenRules,
  onTierSelect,
  onCardSelect,
}: CampaignStageProps) {
  const collectionHeadingMatch = collectionHeading.match(
    /^(.*?)(\d+)(.*)$/,
  );

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
        </div>

        <section
          className="hero campaign-hero campaign-hero-mask"
          aria-labelledby="campaign-title"
          data-tier={heroTier}
        >
          <h1 id="campaign-title" className="sr-only">
            {accessibleTitle}
          </h1>

          <div
            className="hero-media campaign-hero-media campaign-hero-media-layer"
            aria-hidden="true"
          >
            <CampaignHeroMediaSlot media={pack.assets.heroMedia} />
          </div>

          <div
            className="campaign-hero-transition-layer"
            aria-hidden="true"
          />

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
        </section>
      </div>

      <section
        className="collection-panel campaign-reward-shelf"
        aria-labelledby={collectionTitleId}
      >
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
