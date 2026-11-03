/**
 * Supported native clock layouts defined in docs/PACK_FORMAT.md (T2.6).
 */
export type ThemeLayout = "digital" | "ring" | "bar" | "minimal";

/**
 * Visual tokens for customizable themes.
 */
export interface ThemeTokens {
  text: string;
  accent: string;
  accentBreak: string;
  background: string;
  radius: number;
}

/**
 * Built-in and pack theme manifest specification.
 */
export interface ThemeManifest {
  schema: 1;
  id: string;
  name: string;
  description: string;
  layout: ThemeLayout;
  tokens: ThemeTokens;
}

/**
 * Common props passed to each native clock layout component.
 */
export interface ClockLayoutProps {
  formattedTime: string;
  phaseLabel: string;
  phase: "focus" | "short_break" | "long_break";
  status: "ready" | "running" | "paused";
  remainingMs: number;
  totalMs: number;
  alertActive: boolean;
  onToggleRunning: () => void;
  onOpenPanel: () => void;
  onSkip?: () => void;
}
