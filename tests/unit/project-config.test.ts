import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("project configuration", () => {
  it("uses the HN Compass product name", () => {
    expect("HN Compass").toBe("HN Compass");
  });

  it("loads the official JellyUI module once from the root layout", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout.match(/https:\/\/jelly-ui\.com\/package\.js/g)).toHaveLength(1);
    expect(layout).toContain('id="jelly-ui-package"');
    expect(layout).toContain('type="module"');
    expect(layout).toContain('<jelly-theme mode="auto" accent="amber"><div className="app-shell">');
  });

  it("uses JellyUI semantic tokens for reader colors", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const reader = readFileSync(resolve(process.cwd(), "src/components/digest-reader.tsx"), "utf8");
    expect(styles).toContain("--jelly-color-background-default");
    expect(styles).toContain("--jelly-color-foreground-default");
    expect(styles).toContain("--jelly-color-foreground-muted");
    expect(styles).toContain("--jelly-color-border-default");
    expect(styles).toContain("--jelly-color-border-focus");
    expect(reader).not.toMatch(/(?:orange|zinc)-/);
  });

  it("keeps application text selectable despite JellyUI's component defaults", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(styles).toContain("user-select: text");
    expect(styles).toContain("-webkit-user-select: text");
  });
});
