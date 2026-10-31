import { describe, expect, it } from "vitest";
import { APP_NAME, APP_VERSION } from "./appInfo";

describe("appInfo", () => {
  it("exposes the product name", () => {
    expect(APP_NAME).toBe("PomoPet");
  });

  it("exposes a semver version", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
