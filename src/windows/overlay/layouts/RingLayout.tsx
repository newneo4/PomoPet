import type { ClockLayoutProps } from "../../../lib/themes/types";

export function RingLayout({
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
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const elapsed = totalMs > 0 ? Math.max(0, Math.min(totalMs, totalMs - remainingMs)) : 0;
  const progress = totalMs > 0 ? elapsed / totalMs : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const isBreak = phase === "short_break" || phase === "long_break";

  return (
    <div className="layout-ring">
      <div className="layout-ring__top-controls">
        <span className="overlay__drag-grip" title="Arrastrar ventana">
          ⠿
        </span>
        <button
          type="button"
          className="overlay__gear-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPanel();
          }}
          title="Abrir ajustes"
          aria-label="Abrir ajustes"
        >
          ⚙
        </button>
      </div>

      <div className="layout-ring__circle-container">
        <svg
          className="layout-ring__svg"
          width="108"
          height="108"
          viewBox="0 0 108 108"
          aria-hidden="true"
        >
          {/* Background track circle */}
          <circle
            className="layout-ring__track"
            cx="54"
            cy="54"
            r={radius}
            strokeWidth="6"
            fill="transparent"
          />
          {/* Active progress circle */}
          <circle
            className={`layout-ring__progress ${isBreak ? "layout-ring__progress--break" : ""} ${alertActive ? "layout-ring__progress--alert" : ""}`}
            cx="54"
            cy="54"
            r={radius}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            transform="rotate(-90 54 54)"
          />
        </svg>

        <div className="layout-ring__inner-content">
          <span className="layout-ring__phase">{phaseLabel}</span>
          <span className="layout-ring__clock">{formattedTime}</span>
          <button
            type="button"
            className="layout-ring__play-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRunning();
            }}
            title={
              alertActive
                ? "Detener alerta"
                : status === "running"
                  ? "Pausar"
                  : status === "paused"
                    ? "Reanudar"
                    : "Iniciar"
            }
            aria-label={
              alertActive
                ? "Detener alerta"
                : status === "running"
                  ? "Pausar"
                  : status === "paused"
                    ? "Reanudar"
                    : "Iniciar"
            }
          >
            {alertActive ? "⏹" : status === "running" ? "⏸" : "▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
