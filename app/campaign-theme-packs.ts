import type { CSSProperties } from "react";

export type ThemeId = "summer" | "night";

export type CampaignHeroMedia =
  | {
      type: "image";
      src: string;
      assetId?: string;
      fit?: "cover" | "contain";
      position?: string;
      sourceWidth?: number;
      sourceHeight?: number;
    }
  | {
      type: "video";
      src: string;
      assetId?: string;
      poster?: string;
      posterAssetId?: string;
      fit?: "cover" | "contain";
      position?: string;
      sourceWidth?: number;
      sourceHeight?: number;
    };

export type CampaignCollectionHeroLayer = {
  id: string;
  /** Stable collection card ID that controls this layer. */
  cardId: string;
  label: string;
  /** How this card is granted in the campaign rule set. */
  unlockMethod?: "first-gift" | "draw" | "points";
  /** What the Hero does when this card is unlocked. */
  presentation?: "image-layer" | "video-transition" | "none";
  media?: CampaignHeroMedia;
  /** Full-frame transition played when presentation is video-transition. */
  transitionMedia?: CampaignHeroMedia;
  /** Required points when unlockMethod is points. */
  pointsCost?: number;
  /** The item is already baked into the base Hero and needs no overlay. */
  embeddedInBase?: boolean;
  /** Horizontal offset in the 375px Hero design coordinate space. */
  x: number;
  /** Vertical offset in the 500px Hero design coordinate space. */
  y: number;
  /** Layer width in the 375px Hero design coordinate space. */
  width: number;
  /** Clockwise rotation in degrees. */
  rotation: number;
  zIndex: number;
};

export type CampaignCollectionHeroComposition = {
  enabled: boolean;
  /** Stable card IDs granted to a visitor on first entry. */
  initialUnlockedCardIds: string[];
  /**
   * Editor-only flattened reference. It can be shown as an alignment guide,
   * but runtime output is always composed from the base Hero and card layers.
   */
  finalReference?: CampaignHeroMedia;
  layers: CampaignCollectionHeroLayer[];
};

export type CampaignThemePack = {
  assets: {
    /**
     * Optional map layer behind the rounded campaign field. The visible map
     * slot stays 375:78 regardless of the foreground campaign media.
     */
    mapBackgroundImage?: string;
    /**
     * Swappable image or video rendered across the fixed 375:500 media layer.
     * The transition mask and live UI are independent overlays.
     */
    heroMedia: CampaignHeroMedia;
    /** Optional card-ID-driven transparent layers rendered above the Hero. */
    collectionHeroComposition?: CampaignCollectionHeroComposition;
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
        src: "/theme-assets/summer/hero-layer-base.png",
        assetId: "builtin:summer:hero:start:video-native-v1",
        fit: "cover",
        position: "center top",
        sourceWidth: 834,
        sourceHeight: 1112,
      },
      collectionHeroComposition: {
        enabled: true,
        initialUnlockedCardIds: ["watergun"],
        finalReference: {
          type: "image",
          src: "/theme-assets/summer/hero-scene-v2.png",
          assetId: "builtin:summer:hero:end:video-native-v1",
          fit: "cover",
          position: "center top",
          sourceWidth: 834,
          sourceHeight: 1112,
        },
        layers: [
          {
            id: "hero-layer-watergun",
            cardId: "watergun",
            label: "鲨鲨水枪",
            unlockMethod: "first-gift",
            presentation: "image-layer",
            embeddedInBase: true,
            x: 0,
            y: 0,
            width: 76,
            rotation: 0,
            zIndex: 1,
          },
          {
            id: "hero-layer-watermelon",
            cardId: "watermelon",
            label: "冰镇西瓜",
            unlockMethod: "draw",
            presentation: "image-layer",
            media: {
              type: "image",
              src: "/figma/equipment-watermelon-bucket.webp",
              fit: "contain",
              position: "center",
              sourceWidth: 180,
              sourceHeight: 179,
            },
            x: 1,
            y: 330,
            width: 108,
            rotation: -4,
            zIndex: 4,
          },
          {
            id: "hero-layer-surfboard",
            cardId: "surfboard",
            label: "顺风冲浪板",
            unlockMethod: "draw",
            presentation: "image-layer",
            embeddedInBase: true,
            x: 0,
            y: 0,
            width: 118,
            rotation: 0,
            zIndex: 1,
          },
          {
            id: "hero-layer-palmtree",
            cardId: "palmtree",
            label: "海岛椰树",
            media: {
              type: "image",
              src: "/figma/equipment-palm-tree.webp",
              fit: "contain",
              position: "center",
              sourceWidth: 159,
              sourceHeight: 180,
            },
            x: 300,
            y: 112,
            width: 78,
            rotation: 0,
            zIndex: 2,
          },
          {
            id: "hero-layer-floatie",
            cardId: "floatie",
            label: "好运泳圈",
            media: {
              type: "image",
              src: "/figma/equipment-pineapple-float.webp",
              fit: "contain",
              position: "center",
              sourceWidth: 180,
              sourceHeight: 138,
            },
            x: 285,
            y: 292,
            width: 84,
            rotation: 0,
            zIndex: 3,
          },
          {
            id: "hero-layer-deckchair",
            cardId: "deckchair",
            label: "躺赢沙滩椅",
            media: {
              type: "image",
              src: "/figma/equipment-sun-chair.webp",
              fit: "contain",
              position: "center",
              sourceWidth: 150,
              sourceHeight: 180,
            },
            x: 300,
            y: 218,
            width: 62,
            rotation: 0,
            zIndex: 2,
          },
          {
            id: "hero-layer-sunhat",
            cardId: "sunhat",
            label: "遮阳幸运帽",
            x: 0,
            y: 0,
            width: 64,
            rotation: 0,
            zIndex: 2,
          },
        ],
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
