"use client";

import type { CSSProperties, ReactNode } from "react";
import type { CampaignThemePack, ThemeId } from "./campaign-theme-packs";

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
  collectionEyebrow: string;
  collectionHeading: string;
  collectionSubheading: string;
  uniqueCount: number;
  totalCards: number;
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
  collectionEyebrow,
  collectionHeading,
  collectionSubheading,
  uniqueCount,
  totalCards,
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
  const progress = totalCards > 0 ? (uniqueCount / totalCards) * 100 : 0;

  return (
    <section
      className="campaign-stage"
      aria-label="活动主舞台"
      data-testid="campaign-stage"
    >
      <div
        className={`campaign-top-cap ${
          pack.assets.topCapImage ? "has-art" : "is-plain"
        }`}
        aria-hidden="true"
      >
        {pack.assets.topCapImage && (
          <img src={pack.assets.topCapImage} alt="" decoding="async" />
        )}
      </div>

      <section
        className="hero campaign-hero"
        aria-labelledby="campaign-title"
        data-tier={heroTier}
      >
        <h1 id="campaign-title" className="sr-only">
          {accessibleTitle}
        </h1>
        <picture className="hero-media campaign-hero-media">
          <img
            src={pack.assets.heroImage}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </picture>

        <div className="hero-progress-visual" aria-hidden="true">
          {heroCards}
        </div>

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
      </section>

      <section
        className="collection-panel campaign-reward-shelf"
        aria-labelledby={collectionTitleId}
      >
        <div className="collection-heading">
          <div>
            <span>{collectionEyebrow}</span>
            <h2 id={collectionTitleId}>{collectionHeading}</h2>
            <p>{collectionSubheading}</p>
          </div>
          <div className="collection-count">
            <strong>{uniqueCount}</strong>
            <span>/ {totalCards}</span>
          </div>
        </div>

        <div
          className="progress-track"
          aria-label={`已集齐${uniqueCount}种卡`}
        >
          <span style={{ width: `${progress}%` }} />
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
