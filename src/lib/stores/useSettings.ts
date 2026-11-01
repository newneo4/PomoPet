import { useState, useEffect, useCallback, useRef } from "react";
import { ipcClient, type InstalledPack } from "../ipc/client";
import type { Settings } from "../ipc/generated/Settings";
import type { SettingsPatch } from "../ipc/generated/SettingsPatch";
import type { OverlayPatch } from "../ipc/generated/OverlayPatch";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInstalledPacks = useCallback(async () => {
    try {
      const packs = await ipcClient.listInstalledPacks();
      setInstalledPacks(packs);
    } catch {
      // Ignore if outside Tauri / mocking
    }
  }, []);

  useEffect(() => {
    let unlistenSettings: (() => void) | undefined;
    let unlistenContent: (() => void) | undefined;
    let active = true;

    async function init() {
      try {
        const [currentSettings, packs] = await Promise.all([
          ipcClient.getSettings(),
          ipcClient.listInstalledPacks(),
        ]);
        if (active) {
          setSettings(currentSettings);
          setInstalledPacks(packs);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }

      unlistenSettings = await ipcClient.onSettingsChanged((updated) => {
        if (active) {
          setSettings(updated);
        }
      });

      unlistenContent = await ipcClient.onContentChanged(() => {
        if (active) {
          void fetchInstalledPacks();
        }
      });
    }

    void init();

    return () => {
      active = false;
      if (unlistenSettings) unlistenSettings();
      if (unlistenContent) unlistenContent();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchInstalledPacks]);

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const updated = await ipcClient.updateSettings(patch);
      setSettings(updated);
      setSaveStatus("saved");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const updateOverlay = useCallback(
    async (overlayPatch: OverlayPatch) => {
      return updateSettings({ overlay: overlayPatch });
    },
    [updateSettings],
  );

  const activatePet = useCallback(async (id: string) => {
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const updated = await ipcClient.activatePet(id);
      setSettings(updated);
      setInstalledPacks((prev) =>
        prev.map((p) => ({
          ...p,
          active: p.id === id,
        })),
      );
      setSaveStatus("saved");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const resetOverlayPosition = useCallback(async () => {
    try {
      await ipcClient.resetOverlayPosition();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return {
    settings,
    installedPacks,
    loading,
    saveStatus,
    errorMessage,
    updateSettings,
    updateOverlay,
    activatePet,
    resetOverlayPosition,
    refetchInstalledPacks: fetchInstalledPacks,
  };
}
