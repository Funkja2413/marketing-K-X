"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
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

const ADVANCED_ASSET_FIELDS: Array<{
  key: PackAssetKey;
  label: string;
  hint: string;
}> = [
  {
    key: "mapBackgroundImage",
    label: "地图背景图",
    hint: "展示容器 375 × 78 px；建议导出 1125 × 234 px。",
  },
  {
    key: "rewardShelfImage",
    label: "奖励货架皮肤",
    hint: "展示容器 355 × 166 px；建议导出 1065 × 498 px。",
  },
  {
    key: "actionButtonImage",
    label: "主按钮皮肤",
    hint: "展示容器约 207 × 46 px；建议透明图 621 × 138 px。",
  },
  {
    key: "tierFrameImage",
    label: "优惠券框",
    hint: "前三档展示约 46 × 27 px；建议透明图至少 140 × 82 px。",
  },
  {
    key: "cardOwnedFrameImage",
    label: "已获得卡框",
    hint: "展示容器约 59 × 72 px；建议透明图 180 × 220 px。",
  },
  {
    key: "cardMissingFrameImage",
    label: "未获得卡框",
    hint: "展示容器约 59 × 72 px；建议透明图 180 × 220 px。",
  },
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

  const activeDraft =
    drafts.find((draft) => draft.id === activeId) ?? drafts[0];
  const runtimeConfiguration = useMemo(
    () => createConfigurationFromSkin(activeDraft),
    [activeDraft],
  );
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
    <div className="studio-shell" data-testid="config-tool">
      <aside className="studio-sidebar studio-library">
        <header className="studio-brand">
          <span>Campaign Skin Studio</span>
          <h1>活动换肤配置器</h1>
          <p>固定现有页面结构，快速复制并替换整套主题。</p>
        </header>

        <div className="studio-create-row">
          <button type="button" onClick={() => addFromTheme("summer")}>
            + 夏日方案
          </button>
          <button type="button" onClick={() => addFromTheme("night")}>
            + 夜食方案
          </button>
        </div>

        <div className="studio-draft-list" aria-label="主题方案">
          {drafts.map((draft) => (
            <button
              type="button"
              className={draft.id === activeDraft.id ? "active" : ""}
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
                  {draft.baseTheme === "summer" ? "夏日模板" : "夜食模板"}
                </small>
              </span>
            </button>
          ))}
        </div>

        <div className="studio-library-actions">
          <button type="button" onClick={duplicateActive}>
            复制当前方案
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
      </aside>

      <section className="studio-canvas">
        <header className="studio-toolbar">
          <div>
            <small>实时手机预览</small>
            <strong>{activeDraft.name}</strong>
          </div>
          <div className="studio-toolbar-actions">
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

        <div className="studio-preview-world">
          <div className="studio-phone-label">
            <span>画布 375 × 875 px · 9:21</span>
            <b>{activeDraft.baseTheme === "summer" ? "夏日" : "夜食"}</b>
          </div>
          <div
            className="studio-phone"
            data-testid="config-preview"
            data-preview-ratio="9:21"
          >
            <CampaignExperience
              key={activeDraft.id}
              configuration={runtimeConfiguration}
              initialTheme={activeDraft.baseTheme}
              persistProgress={false}
              fixture
            />
          </div>
        </div>

        <footer className="studio-status" role="status">
          <span>{message}</span>
          <button
            type="button"
            onClick={exportActive}
            data-testid="config-export"
          >
            导出当前方案
          </button>
        </footer>
      </section>

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

        <details open>
          <SectionSummary index="01">主题基础</SectionSummary>
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

        <details open>
          <SectionSummary index="02">Hero 与主操作</SectionSummary>
          <div className="studio-section-body">
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
          </div>
        </details>

        <details open>
          <SectionSummary index="03">品牌配色</SectionSummary>
          <div className="studio-section-body">
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

        <details>
          <SectionSummary index="04">页面文案</SectionSummary>
          <div className="studio-section-body">
            <Field label="集卡册名称">
              <input
                type="text"
                value={activeDraft.content.collectionName}
                onChange={(event) =>
                  updateContent({ collectionName: event.target.value })
                }
              />
            </Field>
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
            <Field label="内容流标题">
              <input
                type="text"
                value={activeDraft.content.discoveryTitle}
                onChange={(event) =>
                  updateContent({ discoveryTitle: event.target.value })
                }
              />
            </Field>
            {activeDraft.content.activityBanners.map((banner, index) => (
              <div className="studio-inline-card" key={`${index}-${banner.title}`}>
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

        <details>
          <SectionSummary index="05">卡片与奖励</SectionSummary>
          <div className="studio-section-body">
            <p className="studio-section-note">
              当前模板固定 9 张卡片和 4 档奖励；稳定 ID 不随换肤改变。
            </p>
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
          </div>
        </details>

        <details>
          <SectionSummary index="06">高级皮肤素材</SectionSummary>
          <div className="studio-section-body">
            <p className="studio-section-note">
              可选透明 UI 皮肤；留空时使用模板内置样式。
            </p>
            {ADVANCED_ASSET_FIELDS.map((field) => (
              <Field
                label={field.label}
                hint={field.hint}
                key={field.key}
              >
                <input
                  type="text"
                  value={
                    (activeDraft.pack.assets[field.key] as
                      | string
                      | undefined) ?? ""
                  }
                  onChange={(event) =>
                    updatePackAsset(field.key, event.target.value)
                  }
                />
              </Field>
            ))}
          </div>
        </details>
      </aside>
    </div>
  );
}
