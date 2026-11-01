import type { ClockLayoutProps } from "../../../lib/themes/types";

export function DigitalLayout({
  formattedTime,
  phaseLabel,
  status,
  alertActive,
  onToggleRunning,
  onOpenPanel,
}: ClockLayoutProps) {
  return (
    <div className="layout-digital overlay__pill">
      <div className="overlay__header">
        <span className="overlay__drag-grip" title="Arrastrar ventana">
          ⠿
        </span>
        <span className="overlay__phase">{phaseLabel}</span>
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

      <span className="overlay__clock">{formattedTime}</span>

      <button
        type="button"
        className="overlay__action-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleRunning();
        }}
      >
        {alertActive
          ? "⏰ ¡Detener!"
          : status === "running"
            ? "⏸ Pausar"
            : status === "paused"
              ? "▶ Reanudar"
              : "▶ Iniciar"}
      </button>
    </div>
  );
}
