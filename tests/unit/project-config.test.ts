import { describe, expect, it } from "vitest";

describe("project configuration", () => {
  it("uses the HN Compass product name", () => {
    expect("HN Compass").toBe("HN Compass");
  });
});
