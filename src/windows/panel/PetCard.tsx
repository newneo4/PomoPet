import { useState, useEffect } from "react";
import { ipcClient, type InstalledPack } from "../../lib/ipc/client";
import { useI18n } from "../../lib/i18n";
import type { Language } from "../../lib/ipc/generated/Language";

interface PetCardProps {
  pack: InstalledPack;
  active: boolean;
  language: Language;
  onActivate: (id: string) => void;
  disabled?: boolean;
}

export function PetCard({ pack, active, language, onActivate, disabled = false }: PetCardProps) {
  const { t } = useI18n(language);
  const [imageSrc, setImageSrc] = useState<string>(pack.previewUrl);

  useEffect(() => {
    let mounted = true;
    async function loadPreview() {
      try {
        const b64 = await ipcClient.getPetSprite(pack.id, "preview.png");
        if (mounted && b64) {
          setImageSrc(b64);
        }
      } catch {
        // Fall back to original previewUrl
      }
    }
    void loadPreview();
    return () => {
      mounted = false;
    };
  }, [pack.id]);

  return (
    <div className={`pet-card ${active ? "pet-card--active" : ""}`}>
      <div className="pet-card__preview">
        <img src={imageSrc} alt={pack.name} className="pet-card__image" loading="lazy" />
      </div>
      <div className="pet-card__info">
        <div className="pet-card__header">
          <h3 className="pet-card__name">{pack.name}</h3>
          {active && (
            <span className="pet-card__badge pet-card__badge--active">{t("pets.active")}</span>
          )}
          {pack.bundled && <span className="pet-card__badge">{t("pets.bundled")}</span>}
        </div>
        <p className="pet-card__meta">
          {t("pets.author")}: {pack.author} • v{pack.version}
        </p>
      </div>
      <div className="pet-card__actions">
        <button
          type="button"
          className={`btn ${active ? "btn--secondary" : "btn--primary"}`}
          onClick={() => onActivate(pack.id)}
          disabled={disabled || active}
          aria-label={`${t("pets.activate")} ${pack.name}`}
        >
          {active ? t("pets.active") : t("pets.activate")}
        </button>
      </div>
    </div>
  );
}
