import { type CSSProperties, type MouseEvent, type KeyboardEvent } from "react";
import type { ClockLayoutProps } from "../../../lib/themes/types";
import type { PetClockConfig } from "../../../lib/pet/types";
import { usePetSprite } from "../../../lib/pet/usePetSprite";

export interface SkinnedClockProps extends ClockLayoutProps {
  petId: string;
  config: PetClockConfig;
}

export function SkinnedClock({
  formattedTime,
  phaseLabel,
  phase,
  status,
  remainingMs,
  totalMs,
  alertActive,
  onToggleRunning,
  onOpenPanel,
  petId,
  config,
}: SkinnedClockProps) {
  const frameAsset = config.frameAsset || "sprites/clock_frame.png";
  const frameUrl = usePetSprite(petId, frameAsset);

  const [width, height] = config.size || [220, 64];
  const [inTop, inRight, inBottom, inLeft] = config.progress?.inset || [14, 38, 14, 38];

  const elapsed = totalMs > 0 ? Math.max(0, Math.min(totalMs, totalMs - remainingMs)) : 0;
  const progressPercent = totalMs > 0 ? (elapsed / totalMs) * 100 : 0;
  const isBreak = phase === "short_break" || phase === "long_break";

  const colorFocus = config.progress?.colorFocus || config.tokens?.accent || "#f59e0b";
  const colorBreak = config.progress?.colorBreak || config.tokens?.accentBreak || "#10b981";
  const fillColor = alertActive ? "#ef4444" : isBreak ? colorBreak : colorFocus;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggleRunning();
    }
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    zIndex: 5,
    width: `${width}px`,
    height: `${height}px`,
    backgroundImage: `url("${frameUrl}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    userSelect: "none",
    cursor: "grab",
    boxSizing: "border-box",
  };

  const trackStyle: CSSProperties = {
    position: "absolute",
    top: `${inTop}px`,
    left: `${inLeft}px`,
    right: `${inRight}px`,
    bottom: `${inBottom}px`,
    borderRadius: `${config.tokens?.radius ?? 6}px`,
    overflow: "hidden",
    pointerEvents: "none",
  };

  const fillStyle: CSSProperties = {
    height: "100%",
    width: `${progressPercent}%`,
    backgroundColor: fillColor,
    opacity: 0.28,
    transition: "width 0.8s ease, background-color 0.3s ease",
    boxShadow: `0 0 10px ${fillColor}`,
  };

  const playButtonTitle = alertActive
    ? "Detener alarma"
    : status === "running"
      ? "Pausar temporizador"
      : status === "paused"
        ? "Reanudar temporizador"
        : "Iniciar temporizador";

  const playButtonIcon = alertActive ? "⏹" : status === "running" ? "⏸" : "▶";

  return (
    <div
      className={`skinned-clock ${alertActive ? "skinned-clock--alert" : ""}`}
      style={containerStyle}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={`${phaseLabel}: ${formattedTime}, ${status}`}
    >
      {/* Background Progress Track inside the frame insets */}
      <div style={trackStyle} aria-hidden="true">
        <div style={fillStyle} />
      </div>

      {/* Left Zone: Drag Grip */}
      <div className="skinned-clock__left" title="Arrastrar ventana">
        <span className="overlay__drag-grip">⠿</span>
        <span className="skinned-clock__icon-dot" aria-hidden="true">
          🐾
        </span>
      </div>

      {/* Center Zone: Phase + Time + Mini Progress */}
      <div className="skinned-clock__center">
        <div className="skinned-clock__phase-badge">
          <span>{phaseLabel}</span>
        </div>
        <span className="skinned-clock__time">{formattedTime}</span>
        <div className="skinned-clock__mini-progress" aria-hidden="true">
          <div
            className="skinned-clock__mini-fill"
            style={{ width: `${progressPercent}%`, backgroundColor: fillColor }}
          />
        </div>
      </div>

      {/* Right Zone: Horizontal Button Row (Play/Pause & Settings) */}
      <div
        className="skinned-clock__right"
        onClick={(e: MouseEvent) => e.stopPropagation()}
        onMouseDown={(e: MouseEvent) => e.stopPropagation()}
      >
        <button
          type="button"
          className="skinned-clock__btn skinned-clock__btn--play"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onToggleRunning();
          }}
          onMouseDown={(e: MouseEvent) => e.stopPropagation()}
          title={playButtonTitle}
          aria-label={playButtonTitle}
        >
          {playButtonIcon}
        </button>

        <button
          type="button"
          className="skinned-clock__btn skinned-clock__btn--gear"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onOpenPanel();
          }}
          onMouseDown={(e: MouseEvent) => e.stopPropagation()}
          title="Ajustes"
          aria-label="Abrir ajustes"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
