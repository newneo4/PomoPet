import { useState, useEffect } from "react";
import type { PetManifest } from "./types";
import { BUILTIN_PETS } from "./builtin";
import { ipcClient } from "../ipc/client";

const defaultFallback = BUILTIN_PETS["mielcita"] || BUILTIN_PETS["gato-clasico"]!;

export function usePetManifest(petId: string): { manifest: PetManifest; loading: boolean } {
  const [manifest, setManifest] = useState<PetManifest>(
    () => BUILTIN_PETS[petId] ?? defaultFallback,
  );
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function loadManifest() {
      try {
        const loaded = await ipcClient.getPetManifest(petId);
        if (mounted && loaded && loaded.id === petId) {
          setManifest(loaded);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setManifest(BUILTIN_PETS[petId] ?? defaultFallback);
          setLoading(false);
        }
      }
    }

    void loadManifest();

    let unlisten: (() => void) | undefined;
    void ipcClient
      .onContentChanged(() => {
        void loadManifest();
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [petId]);

  return { manifest, loading };
}
