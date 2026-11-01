import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PanelApp } from "./PanelApp";
import { PetCard } from "./PetCard";

describe("PanelApp component", () => {
  it("renders without throwing an error", () => {
    const html = renderToStaticMarkup(<PanelApp />);
    expect(html).toBeTruthy();
    expect(html).toContain("panel");
  });

  it("renders PetCard with appropriate attributes", () => {
    const html = renderToStaticMarkup(
      <PetCard
        pack={{
          kind: "pet",
          id: "gato-clasico",
          name: "Gato Clásico",
          version: "1.0.0",
          author: "PomoPet",
          license: "CC-BY-4.0",
          bundled: true,
          active: true,
          previewUrl: "pack://localhost/pets/gato-clasico/preview.png",
        }}
        active={true}
        language="es"
        onActivate={() => {}}
      />,
    );
    expect(html).toContain("Gato Clásico");
    expect(html).toContain("pet-card--active");
  });
});
