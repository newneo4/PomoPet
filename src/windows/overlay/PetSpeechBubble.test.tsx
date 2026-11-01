import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PetSpeechBubble } from "./PetSpeechBubble";
import { getPetDialogue } from "../../lib/i18n";

describe("PetSpeechBubble", () => {
  it("renders dialogue text with speech bubble class", () => {
    const html = renderToStaticMarkup(
      <PetSpeechBubble text="¡A recolectar logros! 🍯" onDismiss={() => {}} />,
    );
    expect(html).toContain("speech-bubble");
    expect(html).toContain("¡A recolectar logros! 🍯");
  });

  it("does not render markup when text is empty", () => {
    const html = renderToStaticMarkup(<PetSpeechBubble text="" onDismiss={() => {}} />);
    expect(html).toBe("");
  });
});

describe("getPetDialogue", () => {
  it("returns themed phrases for Mielcita", () => {
    const focusPhrase = getPetDialogue("mielcita", "focusStart", "es");
    expect(typeof focusPhrase).toBe("string");
    expect(focusPhrase.length).toBeGreaterThan(0);

    const pokePhrase = getPetDialogue("mielcita", "poke", "es");
    expect(typeof pokePhrase).toBe("string");
    expect(pokePhrase.length).toBeGreaterThan(0);
  });

  it("returns themed phrases for Gato Clásico", () => {
    const breakPhrase = getPetDialogue("gato-clasico", "breakStart", "es");
    expect(typeof breakPhrase).toBe("string");
    expect(breakPhrase.length).toBeGreaterThan(0);
  });

  it("falls back cleanly on unknown pet or language", () => {
    const fallback = getPetDialogue("unknown-pet", "focusStart", "es");
    expect(typeof fallback).toBe("string");
    expect(fallback.length).toBeGreaterThan(0);
  });
});
