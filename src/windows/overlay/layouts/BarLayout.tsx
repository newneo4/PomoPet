import type { ClockLayoutProps } from "../../../lib/themes/types";

export function BarLayout({
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
    <div className="layout-bar">
      <div className="layout-bar__content">
        <span className="overlay__drag-grip" title="Arrastrar ventana">
          ⠿
        </span>
        <span className="layout-bar__phase">{phaseLabel}</span>
        <span className="layout-bar__clock">{formattedTime}</span>

        <button
          type="button"
          className="layout-bar__btn layout-bar__btn--play"
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
          className="layout-bar__btn layout-bar__btn--gear"
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

      {/* Linear progress track & fill */}
      <div className="layout-bar__progress-track" aria-hidden="true">
        <div
          className={`layout-bar__progress-fill ${isBreak ? "layout-bar__progress-fill--break" : ""} ${alertActive ? "layout-bar__progress-fill--alert" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
