import { memo } from "react";

export interface HeartParticle {
  id: number;
  x: number;
  icon: string;
}

interface PetHeartsProps {
  particles: HeartParticle[];
}

export const PetHearts = memo(function PetHearts({ particles }: PetHeartsProps) {
  if (particles.length === 0) return null;

  return (
    <div className="pet-hearts-container" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="pet-heart-particle"
          style={{ ["--heart-x" as string]: `${p.x}px` }}
        >
          {p.icon}
        </span>
      ))}
    </div>
  );
});
