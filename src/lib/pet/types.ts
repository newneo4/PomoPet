export interface PetStateConfig {
  sheet: string;
  frames: number;
  columns?: number;
  mode: "loop" | "once" | "progress";
  fps?: number;
  loopStart?: number;
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
}
