import { expect, test } from "@playwright/test";

test("seeded digest supports the critical reader journey", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2026-08-24" })).toBeVisible();
  const title = page.getByRole("heading", { name: "Seeded persisted story" });
  await expect.poll(() => title.evaluate((element) => getComputedStyle(element).userSelect)).toBe("text");
  const titleBox = await title.boundingBox();
  if (!titleBox) throw new Error("Expected a visible digest title");
  await page.mouse.move(titleBox.x + 2, titleBox.y + titleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(titleBox.x + titleBox.width - 2, titleBox.y + titleBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).not.toBe("");
  await expect(page.locator("jelly-card")).toHaveCount(2);
  await expect(page.locator("jelly-breadcrumbs")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "閱讀原文" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "查看 HN 討論" }).first()).toBeVisible();
  await page.getByRole("button", { name: "閱讀完整解析" }).first().click();
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

test("a story carrying viewpoints shows its evidence and insider attribution", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("爭論激烈").first()).toBeVisible();

  await page.getByRole("heading", { name: "Seeded evidenced story" }).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "討論證據" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "支持觀點" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "反對觀點" })).toBeVisible();
  await expect(page.getByText("小規模導入確實有效。")).toBeVisible();
  await expect(page.getByText("規模一大成本就失控。")).toBeVisible();
  await expect(page.getByText("投稿者").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "HN #21（在新分頁開啟）" }).first()).toHaveAttribute("href", "https://news.ycombinator.com/item?id=21");
  await expect(page.locator("jelly-card")).toHaveCount(4);
});
