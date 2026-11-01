import type { ClockLayoutProps } from "../../../lib/themes/types";

export function MinimalLayout({
  formattedTime,
  phaseLabel,
  phase,
  status,
  alertActive,
  onToggleRunning,
  onOpenPanel,
}: ClockLayoutProps) {
  const isBreak = phase === "short_break" || phase === "long_break";

  return (
    <div
      className="layout-minimal"
      title={`PomoPet: ${phaseLabel} (${status})`}
      role="region"
      aria-label={`${phaseLabel}: ${formattedTime}`}
    >
      <span className="overlay__drag-grip" title="Arrastrar ventana">
        ⠿
      </span>

      <span
        className={`layout-minimal__dot ${isBreak ? "layout-minimal__dot--break" : ""} ${status === "running" ? "layout-minimal__dot--pulsing" : ""} ${alertActive ? "layout-minimal__dot--alert" : ""}`}
        title={`${phaseLabel}: ${status}`}
        aria-hidden="true"
      />

      <span className="layout-minimal__clock">{formattedTime}</span>

      <div className="layout-minimal__hover-controls">
        <button
          type="button"
          className="layout-minimal__btn"
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
          className="layout-minimal__btn"
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
  );
}
