import { useEffect, useState, useRef } from "react";

interface PetSpeechBubbleProps {
  text: string;
  onDismiss: () => void;
  facingLeft?: boolean;
}

export function PetSpeechBubble({ text, onDismiss, facingLeft = false }: PetSpeechBubbleProps) {
  const [isExiting, setIsExiting] = useState(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!text) return;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 4200);

    const dismissTimer = setTimeout(() => {
      onDismissRef.current();
    }, 4500);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [text]);

  if (!text) return null;

  return (
    <div
      className={`speech-bubble ${facingLeft ? "speech-bubble--flipped" : ""} ${isExiting ? "speech-bubble--exiting" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onDismissRef.current();
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
