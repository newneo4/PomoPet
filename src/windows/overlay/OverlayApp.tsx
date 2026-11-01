import { useState, useEffect, type MouseEvent, type KeyboardEvent } from "react";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { ipcClient } from "../../lib/ipc/client";
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
  const [facingLeft, setFacingLeft] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;

    const checkOrientation = async () => {
      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const monitor = await currentMonitor();
        if (!monitor || !isMounted) return;

        const monitorCenter = monitor.position.x + monitor.size.width / 2;
        const windowCenter = pos.x + 130;
        setFacingLeft(windowCenter > monitorCenter);
      } catch {
        // Non-tauri browser environment fallback
      }
    };

    void checkOrientation();

    try {
      void getCurrentWindow()
        .onMoved(() => {
          void checkOrientation();
        })
        .then((unsub) => {
          if (isMounted) {
            unlisten = unsub;
          } else {
            unsub();
          }
        });
    } catch {
      // Non-tauri browser fallback
    }

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, []);

  const handleContextMenu = async (e: MouseEvent) => {
    e.preventDefault();
    try {
      await ipcClient.showContextMenu();
    } catch {
      setMenuOpen(true);
    }
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
        <div
          className={`overlay__pet-wrapper ${facingLeft ? "overlay__pet-wrapper--flipped" : ""}`}
        >
          <PetRenderer
            petId={petId}
            manifest={manifest}
            state={petState}
            size={108}
            reducedMotion={settings.reducedMotion === "on"}
          />
        </div>
        <div className="overlay__pill">
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
                void openPanel();
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
        <div className="context-menu" onClick={(e) => e.stopPropagation()}>
          <div className="context-menu__header">
            <span>
              {phaseLabel} ({snapshot.cyclesDone}/{snapshot.cyclesUntilLong})
            </span>
            <button
              type="button"
              className="context-menu__close-btn"
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
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
