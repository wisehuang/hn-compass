import { expect, test } from "@playwright/test";

test("seeded digest supports the critical reader journey", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2026-08-24" })).toBeVisible();
  await expect(page.locator("jelly-card")).toHaveCount(1);
  await expect(page.locator("jelly-breadcrumbs")).toHaveCount(1);
  await page.getByRole("link", { name: "Seeded persisted story" }).click();
  await expect(page.getByRole("heading", { name: "Seeded persisted story" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "文章洞見" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "討論洞見" })).toBeVisible();
  await expect(page.getByRole("link", { name: "原文連結（在新分頁開啟）" })).toHaveAttribute("href", "https://example.test/article");
  await expect(page.getByRole("link", { name: "HN 討論（在新分頁開啟）" })).toHaveAttribute("href", "https://news.ycombinator.com/item?id=12345");
  await expect(page.locator("jelly-card")).toHaveCount(3);
  await expect(page.locator("jelly-breadcrumbs")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "回到最新日報" })).toBeFocused();
  expect(await page.locator("main").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
});
