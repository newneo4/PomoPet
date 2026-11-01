import { memo, type CSSProperties } from "react";
import type { PetManifest, PetStateConfig } from "./types";
import type { PetState } from "./petState";
import "./pet.css";

export interface PetRendererProps {
  petId: string;
  manifest: PetManifest;
  state: PetState;
  progress?: number;
  reducedMotion?: boolean;
  size?: number; // Visual display size in pixels (defaults to frameSize[0])
}

export interface ComputedPetStyle {
  displayWidth: number;
  displayHeight: number;
  totalSheetWidth: number;
  sheetUrl: string;
  renderClass: string;
  isProgress: boolean;
  backgroundPosition: string;
  animationStyle: CSSProperties;
}

export function computePetStyle(
  petId: string,
  manifest: PetManifest,
  state: PetState,
  options: {
    size?: number;
    progress?: number;
    reducedMotion?: boolean;
  } = {},
): ComputedPetStyle {
  const [frameW, frameH] = manifest.frameSize;
  const stateConfig: PetStateConfig = manifest.states[state] || manifest.states.idle;

  const displayWidth = options.size || frameW;
  const displayHeight = options.size ? (options.size * frameH) / frameW : frameH;
  const scale = displayWidth / frameW;

  const columns = stateConfig.columns || stateConfig.frames;
  const frames = stateConfig.frames;
  const fps = stateConfig.fps || 4;
  const durationSec = frames / fps;
  const totalSheetWidth = columns * frameW;

  const sheetUrl = `http://pack.localhost/pets/${petId}/${stateConfig.sheet}`;
  const renderClass =
    manifest.render === "pixelated" ? "pet-sprite--pixelated" : "pet-sprite--smooth";

  if (stateConfig.mode === "progress") {
    const progress = options.progress ?? 0;
    const frameIndex = Math.min(frames - 1, Math.max(0, Math.floor(progress * frames)));
    const bgX = -frameIndex * frameW * scale;

    return {
      displayWidth,
      displayHeight,
      totalSheetWidth: totalSheetWidth * scale,
      sheetUrl,
      renderClass,
      isProgress: true,
      backgroundPosition: `${bgX}px 0px`,
      animationStyle: {},
    };
  }

  const isStatic = options.reducedMotion || frames <= 1;
  const animationStyle: CSSProperties = isStatic
    ? {}
    : ({
        animationName: stateConfig.mode === "once" ? "pet-play-once" : "pet-play-loop",
        animationDuration: `${durationSec}s`,
        animationTimingFunction: `steps(${frames})`,
        animationIterationCount: stateConfig.mode === "once" ? 1 : "infinite",
        animationFillMode: stateConfig.mode === "once" ? "forwards" : "none",
        ["--sheet-width" as string]: `-${totalSheetWidth * scale}px`,
      } as CSSProperties);

  return {
    displayWidth,
    displayHeight,
    totalSheetWidth: totalSheetWidth * scale,
    sheetUrl,
    renderClass,
    isProgress: false,
    backgroundPosition: "0px 0px",
    animationStyle,
  };
}

export function PetRendererImpl({
  petId,
  manifest,
  state,
  progress = 0,
  reducedMotion = false,
  size,
}: PetRendererProps) {
  const computed = computePetStyle(petId, manifest, state, {
    progress,
    reducedMotion,
    size,
  });

  const [frameW, frameH] = manifest.frameSize;
  const scale = computed.displayWidth / frameW;

  return (
    <div
      className={`pet-container ${computed.renderClass}`}
      style={{ width: computed.displayWidth, height: computed.displayHeight }}
      role="img"
      aria-label={`${manifest.name}: estado ${state}`}
    >
      <div
        className="pet-sprite"
        style={{
          width: computed.displayWidth,
          height: computed.displayHeight,
          backgroundImage: `url("${computed.sheetUrl}")`,
          backgroundSize: `${computed.totalSheetWidth}px ${frameH * scale}px`,
          backgroundPosition: computed.backgroundPosition,
          ...computed.animationStyle,
        }}
      />
    </div>
  );
}

export const PetRenderer = memo(PetRendererImpl);
