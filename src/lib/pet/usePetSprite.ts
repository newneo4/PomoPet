import { useState, useEffect } from "react";
import { ipcClient } from "../ipc/client";

const spriteCache = new Map<string, string>();

/**
 * Hook to retrieve the pet sprite URL, preferring cached base64 data URLs via IPC
 * with a fallback to the custom `pack://` protocol.
 */
export function usePetSprite(petId: string, sheet: string): string {
  const cacheKey = `${petId}:${sheet}`;
  const defaultUrl = `pack://localhost/pets/${petId}/${sheet}`;
  const [spriteUrl, setSpriteUrl] = useState<string>(() => spriteCache.get(cacheKey) || defaultUrl);

  useEffect(() => {
    if (spriteCache.has(cacheKey)) return;

    let isMounted = true;
    void ipcClient.getPetSprite(petId, sheet).then((dataUrl) => {
      if (dataUrl && isMounted) {
        spriteCache.set(cacheKey, dataUrl);
        setSpriteUrl(dataUrl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [petId, sheet, cacheKey]);

  return spriteCache.get(cacheKey) || spriteUrl;
}
