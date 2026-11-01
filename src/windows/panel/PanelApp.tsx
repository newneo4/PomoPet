import { useState, useEffect, type ChangeEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "../../lib/stores/useSettings";
import { useI18n } from "../../lib/i18n";
import { playChime } from "../../lib/sound";
import { validateNumberField, SETTINGS_LIMITS } from "../../lib/stores/settingsValidators";
import { BUILTIN_THEMES } from "../../lib/themes/builtinThemes";
import { PetCard } from "./PetCard";
import type { Language } from "../../lib/ipc/generated/Language";
import type { ReducedMotion } from "../../lib/ipc/generated/ReducedMotion";

type TabId = "timer" | "sound" | "overlay" | "pets" | "general";

export function PanelApp() {
  const {
    settings,
    installedPacks,
    loading,
    saveStatus,
    errorMessage,
    updateSettings,
    updateOverlay,
    activatePet,
    resetOverlayPosition,
  } = useSettings();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as TabId;
      if (tabParam && ["timer", "sound", "overlay", "pets", "general"].includes(tabParam)) {
        return tabParam;
      }
    }
    return "timer";
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("panel://switch-tab", (event) => {
      const tab = event.payload as TabId;
      if (tab && ["timer", "sound", "overlay", "pets", "general"].includes(tab)) {
        setActiveTab(tab);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const language = settings?.language ?? "system";
  const { t } = useI18n(language);

  // Local editing drafts map to allow smooth typing without jumping or desyncing
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});

  const getInputValue = (
    field: "focusMin" | "shortBreakMin" | "longBreakMin" | "cyclesUntilLong" | "alertSeconds",
  ): string => {
    if (field in editingDrafts) {
      return editingDrafts[field]!;
    }
    return settings ? String(settings[field]) : "";
  };

  const handleInputChange = (field: string, val: string) => {
    setEditingDrafts((prev) => ({ ...prev, [field]: val }));
  };

  const handleBlurNumber = (
    field: "focusMin" | "shortBreakMin" | "longBreakMin" | "cyclesUntilLong" | "alertSeconds",
  ) => {
    const raw = editingDrafts[field];
    if (raw !== undefined) {
      const parsed = parseInt(raw, 10);
      const result = validateNumberField(field, parsed);
      setEditingDrafts((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      void updateSettings({ [field]: result.clamped });
    }
  };

  if (loading || !settings) {
    return (
      <main className="panel panel--loading" role="main">
        <div className="panel__spinner" aria-hidden="true" />
        <p className="panel__loading-text">{t("status.saving")}</p>
      </main>
    );
  }

  return (
    <div className="panel-container">
      {/* Header */}
      <header className="panel-header">
        <div className="panel-header__branding">
          <span className="panel-header__icon" aria-hidden="true">
            ⏱️
          </span>
          <h1 className="panel-header__title">{t("app.title")}</h1>
        </div>

        <div className="panel-header__status">
          {saveStatus === "saving" && (
            <span className="status-badge status-badge--saving" role="status">
              {t("status.saving")}
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="status-badge status-badge--saved" role="status">
              ✓ {t("status.saved")}
            </span>
          )}
          {saveStatus === "error" && (
            <span className="status-badge status-badge--error" role="alert">
              ⚠️ {errorMessage || t("status.error")}
            </span>
          )}
        </div>
      </header>

      {/* Main Body with Tabs */}
      <div className="panel-body">
        {/* Navigation Sidebar */}
        <nav className="panel-nav" role="tablist" aria-label={t("app.title")}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "timer"}
            aria-controls="tab-panel-timer"
            id="tab-timer"
            className={`panel-nav__item ${activeTab === "timer" ? "panel-nav__item--active" : ""}`}
            onClick={() => setActiveTab("timer")}
          >
            <span className="panel-nav__icon" aria-hidden="true">
              ⏱️
            </span>
            <span className="panel-nav__label">{t("nav.timer")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sound"}
            aria-controls="tab-panel-sound"
            id="tab-sound"
            className={`panel-nav__item ${activeTab === "sound" ? "panel-nav__item--active" : ""}`}
            onClick={() => setActiveTab("sound")}
          >
            <span className="panel-nav__icon" aria-hidden="true">
              🔔
            </span>
            <span className="panel-nav__label">{t("nav.sound")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overlay"}
            aria-controls="tab-panel-overlay"
            id="tab-overlay"
            className={`panel-nav__item ${activeTab === "overlay" ? "panel-nav__item--active" : ""}`}
            onClick={() => setActiveTab("overlay")}
          >
            <span className="panel-nav__icon" aria-hidden="true">
              🪟
            </span>
            <span className="panel-nav__label">{t("nav.overlay")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pets"}
            aria-controls="tab-panel-pets"
            id="tab-pets"
            className={`panel-nav__item ${activeTab === "pets" ? "panel-nav__item--active" : ""}`}
            onClick={() => setActiveTab("pets")}
          >
            <span className="panel-nav__icon" aria-hidden="true">
              🐾
            </span>
            <span className="panel-nav__label">{t("nav.pets")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "general"}
            aria-controls="tab-panel-general"
            id="tab-general"
            className={`panel-nav__item ${activeTab === "general" ? "panel-nav__item--active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            <span className="panel-nav__icon" aria-hidden="true">
              ⚙️
            </span>
            <span className="panel-nav__label">{t("nav.general")}</span>
          </button>
        </nav>

        {/* Tab Content Panel */}
        <main className="panel-content">
          {/* TAB 1: TIMER */}
          {activeTab === "timer" && (
            <section
              id="tab-panel-timer"
              role="tabpanel"
              aria-labelledby="tab-timer"
              className="tab-panel"
            >
              <h2 className="tab-panel__title">{t("timer.title")}</h2>

              <div className="form-group">
                <label htmlFor="focusMin" className="form-label">
                  {t("timer.focusMin")}
                </label>
                <div className="form-control-row">
                  <input
                    id="focusMin"
                    type="number"
                    min={SETTINGS_LIMITS.focusMin.min}
                    max={SETTINGS_LIMITS.focusMin.max}
                    value={getInputValue("focusMin")}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("focusMin", e.target.value)
                    }
                    onBlur={() => handleBlurNumber("focusMin")}
                    className="input-number"
                  />
                  <span className="form-unit">min</span>
                </div>
                <p className="form-help">{t("timer.focusMinHelp")}</p>
              </div>

              <div className="form-group">
                <label htmlFor="shortBreakMin" className="form-label">
                  {t("timer.shortBreakMin")}
                </label>
                <div className="form-control-row">
                  <input
                    id="shortBreakMin"
                    type="number"
                    min={SETTINGS_LIMITS.shortBreakMin.min}
                    max={SETTINGS_LIMITS.shortBreakMin.max}
                    value={getInputValue("shortBreakMin")}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("shortBreakMin", e.target.value)
                    }
                    onBlur={() => handleBlurNumber("shortBreakMin")}
                    className="input-number"
                  />
                  <span className="form-unit">min</span>
                </div>
                <p className="form-help">{t("timer.shortBreakMinHelp")}</p>
              </div>

              <div className="form-group">
                <label htmlFor="longBreakMin" className="form-label">
                  {t("timer.longBreakMin")}
                </label>
                <div className="form-control-row">
                  <input
                    id="longBreakMin"
                    type="number"
                    min={SETTINGS_LIMITS.longBreakMin.min}
                    max={SETTINGS_LIMITS.longBreakMin.max}
                    value={getInputValue("longBreakMin")}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("longBreakMin", e.target.value)
                    }
                    onBlur={() => handleBlurNumber("longBreakMin")}
                    className="input-number"
                  />
                  <span className="form-unit">min</span>
                </div>
                <p className="form-help">{t("timer.longBreakMinHelp")}</p>
              </div>

              <div className="form-group">
                <label htmlFor="cyclesUntilLong" className="form-label">
                  {t("timer.cyclesUntilLong")}
                </label>
                <div className="form-control-row">
                  <input
                    id="cyclesUntilLong"
                    type="number"
                    min={SETTINGS_LIMITS.cyclesUntilLong.min}
                    max={SETTINGS_LIMITS.cyclesUntilLong.max}
                    value={getInputValue("cyclesUntilLong")}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("cyclesUntilLong", e.target.value)
                    }
                    onBlur={() => handleBlurNumber("cyclesUntilLong")}
                    className="input-number"
                  />
                  <span className="form-unit">ciclos</span>
                </div>
                <p className="form-help">{t("timer.cyclesUntilLongHelp")}</p>
              </div>

              <div className="form-divider" />

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autoStartBreaks}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ autoStartBreaks: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("timer.autoStartBreaks")}</span>
                    <p className="form-help">{t("timer.autoStartBreaksHelp")}</p>
                  </div>
                </label>
              </div>

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autoStartFocus}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ autoStartFocus: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("timer.autoStartFocus")}</span>
                    <p className="form-help">{t("timer.autoStartFocusHelp")}</p>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* TAB 2: SOUND & ALERTS */}
          {activeTab === "sound" && (
            <section
              id="tab-panel-sound"
              role="tabpanel"
              aria-labelledby="tab-sound"
              className="tab-panel"
            >
              <h2 className="tab-panel__title">{t("sound.title")}</h2>

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ soundEnabled: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("sound.soundEnabled")}</span>
                    <p className="form-help">{t("sound.soundEnabledHelp")}</p>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <div className="slider-header">
                  <label htmlFor="volume" className="form-label">
                    {t("sound.volume")}
                  </label>
                  <span className="slider-badge">{Math.round(settings.volume * 100)}%</span>
                </div>
                <div className="slider-row">
                  <input
                    id="volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.volume}
                    disabled={!settings.soundEnabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const val = parseFloat(e.target.value);
                      void updateSettings({ volume: val });
                    }}
                    className="slider-input"
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => playChime(settings.volume)}
                    disabled={!settings.soundEnabled}
                  >
                    🔊 {t("sound.testSound")}
                  </button>
                </div>
              </div>

              <div className="form-divider" />

              <div className="form-group">
                <label htmlFor="alertSeconds" className="form-label">
                  {t("sound.alertSeconds")}
                </label>
                <div className="form-control-row">
                  <input
                    id="alertSeconds"
                    type="number"
                    min={SETTINGS_LIMITS.alertSeconds.min}
                    max={SETTINGS_LIMITS.alertSeconds.max}
                    value={getInputValue("alertSeconds")}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("alertSeconds", e.target.value)
                    }
                    onBlur={() => handleBlurNumber("alertSeconds")}
                    className="input-number"
                  />
                  <span className="form-unit">seg</span>
                </div>
                <p className="form-help">{t("sound.alertSecondsHelp")}</p>
              </div>

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnExpire}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ notifyOnExpire: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("sound.notifyOnExpire")}</span>
                    <p className="form-help">{t("sound.notifyOnExpireHelp")}</p>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* TAB 3: OVERLAY */}
          {activeTab === "overlay" && (
            <section
              id="tab-panel-overlay"
              role="tabpanel"
              aria-labelledby="tab-overlay"
              className="tab-panel"
            >
              <h2 className="tab-panel__title">{t("overlay.title")}</h2>

              <div className="form-group">
                <label className="form-label">{t("overlay.clockStyle")}</label>
                <p className="form-help">{t("overlay.clockStyleHelp")}</p>
                <div className="theme-grid">
                  {Object.values(BUILTIN_THEMES).map((themeItem) => {
                    const isSelected = (settings.activeThemeId || "clasico") === themeItem.id;
                    const titleKey = `overlay.theme${themeItem.id.charAt(0).toUpperCase() + themeItem.id.slice(1)}`;
                    const descKey = `overlay.theme${themeItem.id.charAt(0).toUpperCase() + themeItem.id.slice(1)}Desc`;
                    const icon =
                      themeItem.layout === "ring"
                        ? "⭕"
                        : themeItem.layout === "bar"
                          ? "━"
                          : themeItem.layout === "minimal"
                            ? "·"
                            : themeItem.layout === "hueso"
                              ? "🦴"
                              : "⏱";

                    return (
                      <div
                        key={themeItem.id}
                        className={`theme-card ${isSelected ? "theme-card--selected" : ""}`}
                        onClick={() => void updateSettings({ activeThemeId: themeItem.id })}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            void updateSettings({ activeThemeId: themeItem.id });
                          }
                        }}
                      >
                        <div className="theme-card__header">
                          <span className="theme-card__icon">{icon}</span>
                          <span className="theme-card__title">{t(titleKey) || themeItem.name}</span>
                          {isSelected && (
                            <span className="theme-card__badge">{t("pets.active")}</span>
                          )}
                        </div>
                        <p className="theme-card__desc">{t(descKey) || themeItem.description}</p>
                        <div className="theme-card__palette" aria-hidden="true">
                          <span
                            className="theme-card__swatch"
                            style={{ backgroundColor: themeItem.tokens.accent }}
                            title="Acento Foco"
                          />
                          <span
                            className="theme-card__swatch"
                            style={{ backgroundColor: themeItem.tokens.accentBreak }}
                            title="Acento Descanso"
                          />
                          <span
                            className="theme-card__swatch"
                            style={{ backgroundColor: themeItem.tokens.background }}
                            title="Fondo"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-divider" />

              <div className="form-group">
                <div className="slider-header">
                  <label htmlFor="scale" className="form-label">
                    {t("overlay.scale")}
                  </label>
                  <span className="slider-badge">{Math.round(settings.overlay.scale * 100)}%</span>
                </div>
                <input
                  id="scale"
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={settings.overlay.scale}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const val = parseFloat(e.target.value);
                    void updateOverlay({ scale: val });
                  }}
                  className="slider-input"
                />
                <p className="form-help">{t("overlay.scaleHelp")}</p>
              </div>

              <div className="form-group">
                <div className="slider-header">
                  <label htmlFor="opacity" className="form-label">
                    {t("overlay.opacity")}
                  </label>
                  <span className="slider-badge">
                    {Math.round(settings.overlay.opacity * 100)}%
                  </span>
                </div>
                <input
                  id="opacity"
                  type="range"
                  min={0.3}
                  max={1.0}
                  step={0.05}
                  value={settings.overlay.opacity}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const val = parseFloat(e.target.value);
                    void updateOverlay({ opacity: val });
                  }}
                  className="slider-input"
                />
                <p className="form-help">{t("overlay.opacityHelp")}</p>
              </div>

              <div className="form-divider" />

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.companionDialogue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ companionDialogue: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("overlay.companionDialogue")}</span>
                    <p className="form-help">{t("overlay.companionDialogueHelp")}</p>
                  </div>
                </label>
              </div>

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.clickThrough}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ clickThrough: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("overlay.clickThrough")}</span>
                    <p className="form-help">{t("overlay.clickThroughHelp")}</p>
                  </div>
                </label>
                {settings.clickThrough && (
                  <div className="alert-box alert-box--warning" role="note">
                    ⚠️ {t("overlay.clickThroughWarning")}
                  </div>
                )}
              </div>

              <div className="form-group action-group">
                <div>
                  <h4 className="action-group__title">{t("overlay.resetPosition")}</h4>
                  <p className="form-help">{t("overlay.resetPositionHelp")}</p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void resetOverlayPosition()}
                >
                  📍 {t("overlay.resetPosition")}
                </button>
              </div>
            </section>
          )}

          {/* TAB 4: PETS */}
          {activeTab === "pets" && (
            <section
              id="tab-panel-pets"
              role="tabpanel"
              aria-labelledby="tab-pets"
              className="tab-panel"
            >
              <h2 className="tab-panel__title">{t("pets.title")}</h2>
              <p className="tab-panel__subtitle">{t("pets.subtitle")}</p>

              <div className="pets-grid">
                {installedPacks.map((pack) => (
                  <PetCard
                    key={pack.id}
                    pack={pack}
                    active={pack.id === settings.activePetId}
                    language={language}
                    onActivate={(id) => void activatePet(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* TAB 5: GENERAL */}
          {activeTab === "general" && (
            <section
              id="tab-panel-general"
              role="tabpanel"
              aria-labelledby="tab-general"
              className="tab-panel"
            >
              <h2 className="tab-panel__title">{t("general.title")}</h2>

              <div className="form-group form-group--checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autostartWithWindows}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      void updateSettings({ autostartWithWindows: e.target.checked })
                    }
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom" aria-hidden="true" />
                  <div>
                    <span className="checkbox-text">{t("general.autostart")}</span>
                    <p className="form-help">{t("general.autostartHelp")}</p>
                  </div>
                </label>
              </div>

              <div className="form-divider" />

              <div className="form-group">
                <label htmlFor="language" className="form-label">
                  {t("general.language")}
                </label>
                <select
                  id="language"
                  value={settings.language}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    void updateSettings({ language: e.target.value as Language });
                  }}
                  className="select-input"
                >
                  <option value="system">{t("general.languageSystem")}</option>
                  <option value="es">{t("general.languageEs")}</option>
                  <option value="en">{t("general.languageEn")}</option>
                </select>
                <p className="form-help">{t("general.languageHelp")}</p>
              </div>

              <div className="form-group">
                <label htmlFor="reducedMotion" className="form-label">
                  {t("general.reducedMotion")}
                </label>
                <select
                  id="reducedMotion"
                  value={settings.reducedMotion}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    void updateSettings({ reducedMotion: e.target.value as ReducedMotion });
                  }}
                  className="select-input"
                >
                  <option value="system">{t("general.reducedMotionSystem")}</option>
                  <option value="on">{t("general.reducedMotionOn")}</option>
                  <option value="off">{t("general.reducedMotionOff")}</option>
                </select>
                <p className="form-help">{t("general.reducedMotionHelp")}</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
