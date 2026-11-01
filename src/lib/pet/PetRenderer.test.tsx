import { describe, it, expect } from "vitest";
import { computePetStyle, PetRendererImpl } from "./PetRenderer";
import { BUILTIN_PETS } from "./builtin";

describe("PetRenderer", () => {
  const catManifest = BUILTIN_PETS["gato-clasico"]!;

  it("computes smooth rendering class and correct dimensions", () => {
    const style = computePetStyle("gato-clasico", catManifest, "idle", { size: 64 });
    expect(style.renderClass).toBe("pet-sprite--smooth");
    expect(style.displayWidth).toBe(64);
    expect(style.displayHeight).toBe(64);
    expect(style.sheetUrl).toBe("http://pack.localhost/pets/gato-clasico/sprites/idle.png");
  });

  it("computes animation for loop mode with correct duration and steps", () => {
    const style = computePetStyle("gato-clasico", catManifest, "focus");
    expect(style.animationStyle.animationName).toBe("pet-play-loop");
    expect(style.animationStyle.animationTimingFunction).toBe("steps(4)");
    // 4 frames at 2 fps = 2s duration
    expect(style.animationStyle.animationDuration).toBe("2s");
  });

  it("disables animation when reducedMotion is true", () => {
    const style = computePetStyle("gato-clasico", catManifest, "idle", { reducedMotion: true });
    expect(style.animationStyle.animationName).toBeUndefined();
    expect(style.backgroundPosition).toBe("0px 0px");
  });

  it("calculates discrete frame position for progress mode", () => {
    const progressManifest = {
      ...catManifest,
      states: {
        ...catManifest.states,
        focus: {
          sheet: "sprites/focus.png",
          frames: 5,
          mode: "progress" as const,
        },
      },
    };

    const style = computePetStyle("gato-clasico", progressManifest, "focus", {
      progress: 0.5,
      size: 128,
    });

    // 0.5 * 5 = frame 2 -> bgX = -2 * 128 = -256px
    expect(style.backgroundPosition).toBe("-256px 0px");
    expect(style.isProgress).toBe(true);
  });

  it("renders PetRendererImpl with accessible attributes", () => {
    const vnode = PetRendererImpl({
      petId: "gato-clasico",
      manifest: catManifest,
      state: "idle",
      size: 64,
    });

    expect(vnode.props.role).toBe("img");
    expect(vnode.props["aria-label"]).toBe("Gato Clásico: estado idle");
  });
});
