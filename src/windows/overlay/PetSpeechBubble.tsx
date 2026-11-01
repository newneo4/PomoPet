import { useEffect } from "react";

interface PetSpeechBubbleProps {
  text: string;
  onDismiss: () => void;
  facingLeft?: boolean;
}

export function PetSpeechBubble({ text, onDismiss, facingLeft = false }: PetSpeechBubbleProps) {
  useEffect(() => {
    if (!text) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, [text, onDismiss]);

  if (!text) return null;

  return (
    <div
      className={`speech-bubble ${facingLeft ? "speech-bubble--flipped" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
      title="Clic para cerrar"
      role="status"
      aria-live="polite"
    >
      <span className="speech-bubble__text">{text}</span>
      <div className="speech-bubble__tail" />
    </div>
  );
}
