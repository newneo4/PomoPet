import { useState, type MouseEvent, type KeyboardEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTimer } from "../../lib/stores/useTimer";
import { PetRenderer } from "../../lib/pet/PetRenderer";
import { BUILTIN_PETS } from "../../lib/pet/builtin";

export function OverlayApp() {
  const {
    snapshot,
    settings,
    formattedTime,
    petState,
    alertActive,
    toggleRunning,
    skip,
    openPanel,
    resetPosition,
    activatePet,
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

  const handleMouseDown = async (e: MouseEvent) => {
    // If context menu is open, close it on click
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    // Only primary (left) button initiates dragging
    if (e.button !== 0) return;

    // Do NOT drag if clicking an interactive element (button or context menu)
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, .context-menu")) {
      return;
    }

    try {
      const win = getCurrentWindow();
      await win.startDragging();
    } catch {
      // Fallback when outside Tauri (dev browser)
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
  const petId = settings.activePetId || "gato-clasico";
  const defaultManifest = BUILTIN_PETS["gato-clasico"]!;
  const manifest = BUILTIN_PETS[petId] ?? defaultManifest;

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
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`Temporizador Pomodoro: ${phaseLabel}, ${formattedTime}, ${snapshot.status}`}
      >
        <div className="overlay__pet-wrapper">
          <PetRenderer
            petId={petId}
            manifest={manifest}
            state={petState}
            size={76}
            reducedMotion={settings.reducedMotion === "on"}
          />
        </div>
        <div className="overlay__pill">
          <div className="overlay__header">
            <span className="overlay__drag-grip" title="Arrastrar ventana">
              ⠿
            </span>
            <span className="overlay__phase">{phaseLabel}</span>
          </div>
          <span className="overlay__clock">{formattedTime}</span>
          <button
            type="button"
            className="overlay__action-btn"
            onClick={(e) => {
              e.stopPropagation();
              void toggleRunning();
            }}
          >
            {alertActive
              ? "⏰ ¡Detener!"
              : snapshot.status === "running"
                ? "⏸ Pausar"
                : snapshot.status === "paused"
                  ? "▶ Reanudar"
                  : "▶ Iniciar"}
          </button>
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
              const petList = ["gato-clasico", "nano-panda", "mielcita"];
              const currentIdx = petList.indexOf(petId);
              const nextPet = petList[(currentIdx + 1) % petList.length] || "gato-clasico";
              void activatePet(nextPet);
            }}
          >
            Mascota:{" "}
            {petId === "gato-clasico"
              ? "Usar Nano Panda"
              : petId === "nano-panda"
                ? "Usar Mielcita"
                : "Usar Gato Clásico"}
          </button>
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
