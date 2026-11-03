export interface PetStateConfig {
  sheet: string;
  frames: number;
  columns?: number;
  mode: "loop" | "once" | "progress";
  fps?: number;
  loopStart?: number;
}

export interface PetDialogueCategory {
  focusStart?: string[];
  breakStart?: string[];
  alert?: string[];
  poke?: string[];
}

export interface PetClockProgress {
  type: "horizontal-bar" | "vertical-bar";
  inset?: [number, number, number, number];
  colorFocus?: string;
  colorBreak?: string;
}

export interface PetClockTokens {
  text?: string;
  accent?: string;
  accentBreak?: string;
  background?: string;
  radius?: number;
}

export interface PetClockConfig {
  mode: "native" | "skinned";
  layout?: string;
  tokens?: PetClockTokens;
  size?: [number, number];
  frameAsset?: string;
  progress?: PetClockProgress;
}

export interface PetManifest {
  schema: number;
  type: "pet";
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  description?: string;
  frameSize: [number, number];
  render?: "smooth" | "pixelated";
  states: {
    idle: PetStateConfig;
    focus: PetStateConfig;
    break: PetStateConfig;
    alert: PetStateConfig;
    paused?: PetStateConfig;
    [key: string]: PetStateConfig | undefined;
  };
  dialogues?: Record<string, PetDialogueCategory>;
  particles?: string[];
  clock?: PetClockConfig;
}
