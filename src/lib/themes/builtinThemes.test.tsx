import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILTIN_THEMES, DEFAULT_THEME_ID, getTheme } from "./builtinThemes";
import { DigitalLayout, RingLayout, BarLayout, MinimalLayout } from "../../windows/overlay/layouts";
import type { ClockLayoutProps } from "./types";

describe("BUILTIN_THEMES", () => {
  it("provides definitions for all 4 contract layouts", () => {
    const layouts = Object.values(BUILTIN_THEMES).map((t) => t.layout);
    expect(layouts).toContain("digital");
    expect(layouts).toContain("ring");
    expect(layouts).toContain("bar");
    expect(layouts).toContain("minimal");
  });

  it("getTheme returns correct theme and falls back to default", () => {
    expect(getTheme("anillo").layout).toBe("ring");
    expect(getTheme("barra").layout).toBe("bar");
    expect(getTheme("minimalista").layout).toBe("minimal");
    expect(getTheme("clasico").layout).toBe("digital");
    expect(getTheme("non-existent-theme").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
  });

  it("tokens conform to valid styling properties", () => {
    for (const theme of Object.values(BUILTIN_THEMES)) {
      expect(theme.tokens.text).toBeDefined();
      expect(theme.tokens.accent).toBeDefined();
      expect(theme.tokens.accentBreak).toBeDefined();
      expect(theme.tokens.background).toBeDefined();
      expect(typeof theme.tokens.radius).toBe("number");
      expect(theme.tokens.radius).toBeGreaterThanOrEqual(0);
      expect(theme.tokens.radius).toBeLessThanOrEqual(56);
    }
  });
});

describe("Native Clock Layouts rendering", () => {
  const commonProps: ClockLayoutProps = {
    formattedTime: "24:59",
    phaseLabel: "Foco",
    phase: "focus",
    status: "running",
    remainingMs: 1499000,
    totalMs: 1500000,
    alertActive: false,
    onToggleRunning: () => {},
    onOpenPanel: () => {},
    onSkip: () => {},
  };

  it("renders DigitalLayout correctly", () => {
    const html = renderToStaticMarkup(<DigitalLayout {...commonProps} />);
    expect(html).toContain("24:59");
    expect(html).toContain("layout-digital");
    expect(html).toContain("Foco");
  });

  it("renders RingLayout correctly with SVG circle and time", () => {
    const html = renderToStaticMarkup(<RingLayout {...commonProps} />);
    expect(html).toContain("24:59");
    expect(html).toContain("layout-ring");
    expect(html).toContain("layout-ring__svg");
    expect(html).toContain("layout-ring__progress");
  });

  it("renders BarLayout correctly with progress track", () => {
    const html = renderToStaticMarkup(<BarLayout {...commonProps} />);
    expect(html).toContain("24:59");
    expect(html).toContain("layout-bar");
    expect(html).toContain("layout-bar__progress-track");
  });

  it("renders MinimalLayout correctly with status dot", () => {
    const html = renderToStaticMarkup(<MinimalLayout {...commonProps} />);
    expect(html).toContain("24:59");
    expect(html).toContain("layout-minimal");
    expect(html).toContain("layout-minimal__dot");
  });
});
