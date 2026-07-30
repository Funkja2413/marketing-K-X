import type { CSSProperties } from "react";

export type ThemeId = "summer" | "night";

export type CampaignHeroMedia =
  | {
      type: "image";
      src: string;
      fit?: "cover" | "contain";
      position?: string;
      sourceWidth?: number;
      sourceHeight?: number;
    }
  | {
      type: "video";
      src: string;
      poster?: string;
      fit?: "cover" | "contain";
      position?: string;
      sourceWidth?: number;
      sourceHeight?: number;
    };

export type CampaignThemePack = {
  assets: {
    /**
     * Optional map layer behind the rounded campaign field. The visible map
     * slot stays 375:78 regardless of the foreground campaign media.
     */
    mapBackgroundImage?: string;
    /**
     * Swappable image or video rendered across the fixed 375:460 media layer.
     * The transition mask and live UI are independent overlays.
     */
    heroMedia: CampaignHeroMedia;
    /** Optional transparent art used by the final reward tier. */
    grandRewardImage?: string;
    /** Optional full-bleed UI skins; geometry still comes from CampaignStage. */
    rewardShelfImage?: string;
    actionButtonImage?: string;
    tierFrameImage?: string;
    cardOwnedFrameImage?: string;
    cardMissingFrameImage?: string;
  };
  colors: {
    page: string;
    mapBackground: string;
    heroBackground: string;
    surface: string;
    surfaceText: string;
    mutedText: string;
    accent: string;
    accentText: string;
    actionStart: string;
    actionEnd: string;
    actionShadow: string;
    sideAction: string;
    sideActionText: string;
    tabSurface: string;
    tabText: string;
    tabActiveSurface: string;
    tabActiveText: string;
    cardBorder: string;
    cardOwned: string;
    cardMissing: string;
    countBadge: string;
  };
};

export const THEME_PACKS: Record<ThemeId, CampaignThemePack> = {
  summer: {
    assets: {
      mapBackgroundImage: "/figma/crops/map-cap.png",
      heroMedia: {
        type: "image",
        src: "/theme-assets/summer/hero-scene-v2.png",
        fit: "cover",
        position: "center top",
        sourceWidth: 375,
        sourceHeight: 474,
      },
      grandRewardImage: "/figma/reward-gold-horse.webp",
    },
    colors: {
      page: "#bcecff",
      mapBackground: "#dfeef8",
      heroBackground: "#19a9ed",
      surface: "rgba(253, 254, 252, 0.97)",
      surfaceText: "#101921",
      mutedText: "#6b8a99",
      accent: "#159de4",
      accentText: "#ffffff",
      actionStart: "#ff4d40",
      actionEnd: "#ff2821",
      actionShadow: "#c91f19",
      sideAction: "rgba(232, 250, 255, 0.96)",
      sideActionText: "#071925",
      tabSurface: "rgba(230, 247, 255, 0.96)",
      tabText: "#5b879c",
      tabActiveSurface: "#ffffff",
      tabActiveText: "#087bb4",
      cardBorder: "#cde4ec",
      cardOwned: "#87ddfb",
      cardMissing: "#e2edf1",
      countBadge: "#baff20",
    },
  },
  night: {
    assets: {
      mapBackgroundImage: "/figma/crops/map-cap.png",
      heroMedia: {
        type: "image",
        src: "/theme-assets/night/hero-scene.webp",
        fit: "contain",
        position: "center top",
        sourceWidth: 1125,
        sourceHeight: 1125,
      },
    },
    colors: {
      page: "#24120d",
      mapBackground: "#dfeef8",
      heroBackground: "#1b0d09",
      surface: "rgba(111, 56, 36, 0.98)",
      surfaceText: "#fff0d4",
      mutedText: "#c29b87",
      accent: "#caff42",
      accentText: "#1b170d",
      actionStart: "#ff5940",
      actionEnd: "#f33121",
      actionShadow: "#971b12",
      sideAction: "rgba(110, 55, 34, 0.96)",
      sideActionText: "#ffe1b3",
      tabSurface: "rgba(54, 25, 18, 0.92)",
      tabText: "#c9a693",
      tabActiveSurface: "#fff0d4",
      tabActiveText: "#4a1f11",
      cardBorder: "#9b654e",
      cardOwned: "#6f3824",
      cardMissing: "#3b1c13",
      countBadge: "#caff42",
    },
  },
};

export function getThemePackStyle(pack: CampaignThemePack): CSSProperties {
  return {
    "--stage-page": pack.colors.page,
    "--stage-map": pack.colors.mapBackground,
    "--stage-hero": pack.colors.heroBackground,
    "--stage-surface": pack.colors.surface,
    "--stage-text": pack.colors.surfaceText,
    "--stage-muted": pack.colors.mutedText,
    "--stage-accent": pack.colors.accent,
    "--stage-accent-text": pack.colors.accentText,
    "--stage-action-start": pack.colors.actionStart,
    "--stage-action-end": pack.colors.actionEnd,
    "--stage-action-shadow": pack.colors.actionShadow,
    "--stage-side-action": pack.colors.sideAction,
    "--stage-side-action-text": pack.colors.sideActionText,
    "--stage-tab-surface": pack.colors.tabSurface,
    "--stage-tab-text": pack.colors.tabText,
    "--stage-tab-active-surface": pack.colors.tabActiveSurface,
    "--stage-tab-active-text": pack.colors.tabActiveText,
    "--stage-card-border": pack.colors.cardBorder,
    "--stage-card-owned": pack.colors.cardOwned,
    "--stage-card-missing": pack.colors.cardMissing,
    "--stage-count-badge": pack.colors.countBadge,
    "--stage-reward-shelf-image": pack.assets.rewardShelfImage
      ? `url("${pack.assets.rewardShelfImage}")`
      : "none",
    "--stage-action-image": pack.assets.actionButtonImage
      ? `url("${pack.assets.actionButtonImage}")`
      : "none",
    "--stage-tier-frame-image": pack.assets.tierFrameImage
      ? `url("${pack.assets.tierFrameImage}")`
      : "none",
    "--stage-card-owned-frame-image": pack.assets.cardOwnedFrameImage
      ? `url("${pack.assets.cardOwnedFrameImage}")`
      : "none",
    "--stage-card-missing-frame-image": pack.assets.cardMissingFrameImage
      ? `url("${pack.assets.cardMissingFrameImage}")`
      : "none",
  } as CSSProperties;
}
