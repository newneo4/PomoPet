import type { ClockLayoutProps } from "../../../lib/themes/types";

export function BoneLayout({
  formattedTime,
  phaseLabel,
  phase,
  status,
  remainingMs,
  totalMs,
  alertActive,
  onToggleRunning,
  onOpenPanel,
}: ClockLayoutProps) {
  const elapsed = totalMs > 0 ? Math.max(0, Math.min(totalMs, totalMs - remainingMs)) : 0;
  const percent = totalMs > 0 ? Math.round((elapsed / totalMs) * 100) : 0;
  const isBreak = phase === "short_break" || phase === "long_break";

  return (
    <div
      className={`layout-bone ${isBreak ? "layout-bone--break" : ""} ${alertActive ? "layout-bone--alert" : ""}`}
    >
      {/* SVG Bone Silhouette Backdrop */}
      <svg
        className="layout-bone__svg-bg"
        viewBox="0 0 220 64"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="boneBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3a2213" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#221208" stopOpacity="0.97" />
          </linearGradient>
          <linearGradient id="boneBreakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#143525" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0b2016" stopOpacity="0.97" />
          </linearGradient>
          <linearGradient id="boneAlertGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#581c1c" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#350e0e" stopOpacity="0.97" />
          </linearGradient>
        </defs>
        <path
          d="M 34,14
             C 26,4 10,5 6,17
             C 1,26 9,32 16,32
             C 9,32 1,38 6,47
             C 10,59 26,60 34,50
             L 186,50
             C 194,60 210,59 214,47
             C 219,38 211,32 204,32
             C 211,32 219,26 214,17
             C 210,5 194,4 186,14
             Z"
          fill={
            alertActive
              ? "url(#boneAlertGradient)"
              : isBreak
                ? "url(#boneBreakGradient)"
                : "url(#boneBodyGradient)"
          }
          className="layout-bone__outline"
        />
      </svg>

      {/* Interactive Controls & Time Grid */}
      <div className="layout-bone__content">
        {/* Left Knob Controls */}
        <div className="layout-bone__left-knob">
          <span className="overlay__drag-grip" title="Arrastrar ventana">
            ⠿
          </span>
          <span className="layout-bone__paw" title="Huellita canina" aria-hidden="true">
            🐾
          </span>
        </div>

        {/* Center Shaft: Phase & Clock */}
        <div className="layout-bone__center">
          <div className="layout-bone__phase-badge">
            <span className="layout-bone__bone-icon">🦴</span>
            <span>{phaseLabel}</span>
          </div>

          <span className="layout-bone__clock">{formattedTime}</span>

          {/* Biscuit Progress Bar */}
          <div className="layout-bone__progress-track" aria-hidden="true">
            <div
              className={`layout-bone__progress-fill ${isBreak ? "layout-bone__progress-fill--break" : ""}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Right Knob Controls */}
        <div className="layout-bone__right-knob">
          <button
            type="button"
            className="layout-bone__btn layout-bone__btn--play"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRunning();
            }}
            title={
              alertActive
                ? "Detener"
                : status === "running"
                  ? "Pausar"
                  : status === "paused"
                    ? "Reanudar"
                    : "Iniciar"
            }
            aria-label={
              alertActive
                ? "Detener"
                : status === "running"
                  ? "Pausar"
                  : status === "paused"
                    ? "Reanudar"
                    : "Iniciar"
            }
          >
            {alertActive ? "⏹" : status === "running" ? "⏸" : "▶"}
          </button>

          <button
            type="button"
            className="layout-bone__btn layout-bone__btn--gear"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPanel();
            }}
            title="Ajustes"
            aria-label="Ajustes"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
