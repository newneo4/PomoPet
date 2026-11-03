import type { ClockLayoutProps, ThemeManifest } from "../../lib/themes/types";
import type { PetManifest } from "../../lib/pet/types";
import { ClockErrorBoundary } from "./ClockErrorBoundary";
import { DigitalLayout, RingLayout, BarLayout, MinimalLayout, SkinnedClock } from "./layouts";

export interface ClockHostProps {
  manifest: PetManifest;
  theme: ThemeManifest;
  activeThemeId: string;
  clockProps: ClockLayoutProps;
}

export function ClockHost({ manifest, theme, activeThemeId, clockProps }: ClockHostProps) {
  const isSkinned =
    (activeThemeId === "pet-skinned" || activeThemeId === "skinned") &&
    manifest.clock?.mode === "skinned";

  return (
    <ClockErrorBoundary clockProps={clockProps}>
      {isSkinned && manifest.clock ? (
        <SkinnedClock petId={manifest.id} config={manifest.clock} {...clockProps} />
      ) : theme.layout === "ring" ? (
        <RingLayout {...clockProps} />
      ) : theme.layout === "bar" ? (
        <BarLayout {...clockProps} />
      ) : theme.layout === "minimal" ? (
        <MinimalLayout {...clockProps} />
      ) : (
        <DigitalLayout {...clockProps} />
      )}
    </ClockErrorBoundary>
  );
}
