import { useState, type MouseEvent, type KeyboardEvent } from "react";
import { useTimer } from "../../lib/stores/useTimer";

export function OverlayApp() {
  const {
    snapshot,
    settings,
    formattedTime,
    alertActive,
    toggleRunning,
    skip,
    openPanel,
    resetPosition,
    setClickThrough,
    quit,
  } = useTimer();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const handleOverlayClick = (e: MouseEvent) => {
    // If context menu is open, just close it
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    // Only handle primary click
    if (e.button === 0) {
      void toggleRunning();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      void toggleRunning();
    } else if (e.key === "Escape") {
      setMenuOpen(false);
    }
  };

  const phaseLabel =
    snapshot.phase === "focus"
      ? "Foco"
      : snapshot.phase === "short_break"
        ? "Descanso"
        : "Descanso Largo";

  const scale = settings.overlay.scale || 1.0;
  const opacity = settings.overlay.opacity || 1.0;

  return (
    <div
      className="overlay-container"
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
      onContextMenu={handleContextMenu}
    >
      <main
        className={`overlay ${alertActive ? "overlay--alert" : ""} overlay--${snapshot.status}`}
        data-tauri-drag-region
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Temporizador Pomodoro: ${phaseLabel}, ${formattedTime}, ${snapshot.status}`}
      >
        <div className="overlay__pill" data-tauri-drag-region>
          <span className="overlay__phase" data-tauri-drag-region>
            {phaseLabel}
          </span>
          <span className="overlay__clock" data-tauri-drag-region>
            {formattedTime}
          </span>
          <span className="overlay__status" data-tauri-drag-region>
            {alertActive
              ? "⏰ ¡Tiempo!"
              : snapshot.status === "running"
                ? "⏸ Pausar"
                : snapshot.status === "paused"
                  ? "▶ Reanudar"
                  : "▶ Iniciar"}
          </span>
        </div>
      </main>

      {menuOpen && (
        <div
          className="context-menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu__header">
            {phaseLabel} ({snapshot.cyclesDone}/{snapshot.cyclesUntilLong})
          </div>
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setMenuOpen(false);
              void toggleRunning();
            }}
          >
            {snapshot.status === "running" ? "Pausar" : "Iniciar / Reanudar"}
          </button>
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setMenuOpen(false);
              void skip();
            }}
          >
            Saltar a siguiente fase
          </button>
          <hr className="context-menu__divider" />
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setMenuOpen(false);
              void openPanel();
            }}
          >
            Ajustes...
          </button>
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setMenuOpen(false);
              void setClickThrough(true);
            }}
          >
            Click-through (atravesar clics)
          </button>
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setMenuOpen(false);
              void resetPosition();
            }}
          >
            Restablecer posición
          </button>
          <hr className="context-menu__divider" />
          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={() => {
              setMenuOpen(false);
              void quit();
            }}
          >
            Salir de PomoPet
          </button>
        </div>
      )}
    </div>
  );
}
