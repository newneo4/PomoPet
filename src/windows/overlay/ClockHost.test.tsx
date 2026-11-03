import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClockHost } from "./ClockHost";
import type { PetManifest } from "../../lib/pet/types";
import { BUILTIN_THEMES } from "../../lib/themes/builtinThemes";
import type { ClockLayoutProps } from "../../lib/themes/types";

const mockClockProps: ClockLayoutProps = {
  formattedTime: "24:59",
  phaseLabel: "Foco",
  phase: "focus",
  status: "running",
  remainingMs: 25 * 60 * 1000 - 1000,
  totalMs: 25 * 60 * 1000,
  alertActive: false,
  onToggleRunning: vi.fn(),
  onOpenPanel: vi.fn(),
  onSkip: vi.fn(),
};

describe("ClockHost & ClockErrorBoundary", () => {
  it("renders default DigitalLayout when pet has no custom clock and theme is clasico", () => {
    const basicManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "pato",
      name: "Pato",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
    };

    const html = renderToStaticMarkup(
      <ClockHost
        manifest={basicManifest}
        theme={BUILTIN_THEMES.clasico!}
        activeThemeId="clasico"
        clockProps={mockClockProps}
      />,
    );

    expect(html).toContain("24:59");
    expect(html).toContain("Foco");
    expect(html).toContain("overlay__pill");
  });

  it("renders SkinnedClock when activeThemeId is pet-skinned and pet defines skinned clock", () => {
    const skinnedManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "mielcita",
      name: "Mielcita",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
      clock: {
        mode: "skinned",
        size: [220, 64],
        frameAsset: "sprites/clock_frame.png",
      },
    };

    const html = renderToStaticMarkup(
      <ClockHost
        manifest={skinnedManifest}
        theme={BUILTIN_THEMES.clasico!}
        activeThemeId="pet-skinned"
        clockProps={mockClockProps}
      />,
    );

    expect(html).toContain("skinned-clock");
    expect(html).toContain("skinned-clock__left");
    expect(html).toContain("skinned-clock__center");
    expect(html).toContain("skinned-clock__right");
    expect(html).toContain("skinned-clock__btn--play");
    expect(html).toContain("skinned-clock__btn--gear");
    expect(html).toContain("24:59");
    expect(html).toContain("Foco");

    const leftIdx = html.indexOf("skinned-clock__left");
    const centerIdx = html.indexOf("skinned-clock__center");
    const rightIdx = html.indexOf("skinned-clock__right");
    expect(leftIdx).toBeGreaterThan(-1);
    expect(centerIdx).toBeGreaterThan(leftIdx);
    expect(rightIdx).toBeGreaterThan(centerIdx);
  });

  it("renders themed native layout when theme is ring or bar", () => {
    const basicManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "gato-clasico",
      name: "Gato Clásico",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
    };

    const htmlRing = renderToStaticMarkup(
      <ClockHost
        manifest={basicManifest}
        theme={BUILTIN_THEMES.anillo!}
        activeThemeId="anillo"
        clockProps={mockClockProps}
      />,
    );
    expect(htmlRing).toContain("layout-ring");

    const htmlBar = renderToStaticMarkup(
      <ClockHost
        manifest={basicManifest}
        theme={BUILTIN_THEMES.barra!}
        activeThemeId="barra"
        clockProps={mockClockProps}
      />,
    );
    expect(htmlBar).toContain("layout-bar");
  });
});
