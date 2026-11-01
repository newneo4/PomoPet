import { useState, useEffect, useRef, type MouseEvent, type KeyboardEvent } from "react";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { ipcClient } from "../../lib/ipc/client";
import { useTimer } from "../../lib/stores/useTimer";
import { PetRenderer } from "../../lib/pet/PetRenderer";
import { BUILTIN_PETS } from "../../lib/pet/builtin";
import { resolveLanguage, getPetDialogue } from "../../lib/i18n";
import { getTheme } from "../../lib/themes/builtinThemes";
import type { ClockLayoutProps } from "../../lib/themes/types";
import { PetSpeechBubble } from "./PetSpeechBubble";
import { PetHearts, type HeartParticle } from "./PetHearts";
import { DigitalLayout, RingLayout, BarLayout, MinimalLayout, BoneLayout } from "./layouts";

export function OverlayApp() {
  const {
    snapshot,
    settings,
    remainingMs,
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
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const [particles, setParticles] = useState<HeartParticle[]>([]);

  const currentLang = resolveLanguage(settings.language);
  const petId = settings.activePetId || "mielcita";
  const defaultManifest = BUILTIN_PETS["mielcita"] || BUILTIN_PETS["gato-clasico"]!;
  const manifest = BUILTIN_PETS[petId] ?? defaultManifest;

  const prevPhaseRef = useRef(snapshot.phase);
  const prevStatusRef = useRef(snapshot.status);
  const prevAlertRef = useRef(alertActive);

  // Trigger contextual dialogue on timer phase transitions
  useEffect(() => {
    if (!settings.companionDialogue) {
      prevPhaseRef.current = snapshot.phase;
      prevStatusRef.current = snapshot.status;
      prevAlertRef.current = alertActive;
      return;
    }

    const prevPhase = prevPhaseRef.current;
    const prevStatus = prevStatusRef.current;
    const prevAlert = prevAlertRef.current;

    // Transition to running focus
    if (
      snapshot.phase === "focus" &&
      snapshot.status === "running" &&
      (prevStatus !== "running" || prevPhase !== "focus")
    ) {
      setBubbleText(getPetDialogue(petId, "focusStart", currentLang));
    }
    // Transition to running break
    else if (
      (snapshot.phase === "short_break" || snapshot.phase === "long_break") &&
      snapshot.status === "running" &&
      (prevStatus !== "running" || prevPhase === "focus")
    ) {
      setBubbleText(getPetDialogue(petId, "breakStart", currentLang));
    }
    // Timer expired alert
    else if (alertActive && !prevAlert) {
      setBubbleText(getPetDialogue(petId, "alert", currentLang));
    }

    prevPhaseRef.current = snapshot.phase;
    prevStatusRef.current = snapshot.status;
    prevAlertRef.current = alertActive;
  }, [
    snapshot.phase,
    snapshot.status,
    alertActive,
    settings.companionDialogue,
    petId,
    currentLang,
  ]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;

    const checkOrientation = async () => {
      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const size = await win.outerSize();
        const monitor = await currentMonitor();
        if (!monitor || !isMounted) return;

        const monitorCenter = monitor.position.x + monitor.size.width / 2;
        const windowCenter = pos.x + size.width / 2;
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

    // Do NOT drag if clicking an interactive element (button, context menu, pet, speech bubble)
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, .context-menu, .speech-bubble, .overlay__pet-wrapper")) {
      return;
    }

    try {
      const win = getCurrentWindow();
      await win.startDragging();
    } catch {
      // Fallback when outside Tauri (dev browser)
    }
  };

  const handlePetPoke = (e: MouseEvent) => {
    e.stopPropagation();
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 450);

    const now = Date.now();
    const icons = ["❤️", "🐝", "✨", "🍯", "💖", "⭐"];
    const getRandomIcon = () => icons[Math.floor(Math.random() * icons.length)] || "❤️";
    setParticles([
      { id: now, x: -22, driftX: -18, icon: getRandomIcon() },
      { id: now + 1, x: 0, driftX: 0, icon: getRandomIcon() },
      { id: now + 2, x: 22, driftX: 18, icon: getRandomIcon() },
    ]);
    setTimeout(() => setParticles([]), 950);

    if (settings.companionDialogue) {
      setBubbleText(getPetDialogue(petId, "poke", currentLang));
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
  const theme = getTheme(settings.activeThemeId);

  const clockProps: ClockLayoutProps = {
    formattedTime,
    phaseLabel,
    phase: snapshot.phase,
    status: snapshot.status,
    remainingMs,
    totalMs: snapshot.totalMs,
    alertActive,
    onToggleRunning: () => void toggleRunning(),
    onOpenPanel: () => void openPanel(),
    onSkip: () => void skip(),
  };

  const renderClockLayout = () => {
    switch (theme.layout) {
      case "ring":
        return <RingLayout {...clockProps} />;
      case "bar":
        return <BarLayout {...clockProps} />;
      case "minimal":
        return <MinimalLayout {...clockProps} />;
      case "hueso":
        return <BoneLayout {...clockProps} />;
      case "digital":
      default:
        return <DigitalLayout {...clockProps} />;
    }
  };

  return (
    <div
      className="overlay-container"
      style={
        {
          transform: `scale(${scale})`,
          opacity,
          "--theme-text": theme.tokens.text,
          "--theme-accent": theme.tokens.accent,
          "--theme-accent-break": theme.tokens.accentBreak,
          "--theme-bg": theme.tokens.background,
          "--theme-radius": `${theme.tokens.radius}px`,
        } as React.CSSProperties
      }
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
        <div className="overlay__pet-area">
          <div className="speech-bubble-wrapper">
            <PetSpeechBubble
              text={bubbleText || ""}
              onDismiss={() => setBubbleText(null)}
              facingLeft={facingLeft}
            />
          </div>

          <PetHearts particles={particles} />

          <div
            className={`overlay__pet-wrapper ${facingLeft ? "overlay__pet-wrapper--flipped" : ""} ${isBouncing ? "pet--bouncing" : ""}`}
            onClick={handlePetPoke}
            title="¡Acariciar mascota!"
          >
            <PetRenderer
              petId={petId}
              manifest={manifest}
              state={petState}
              size={108}
              reducedMotion={settings.reducedMotion === "on"}
            />
          </div>
        </div>

        {renderClockLayout()}
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
