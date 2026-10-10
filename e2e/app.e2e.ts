import { test, expect } from "@playwright/test";
test("スマホで設定・点数入力・永続化・修正・CSV・削除・オフライン", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "＋ 半荘の結果を入力" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  for (const [seat, name] of [
    ["東家", "Alice"],
    ["南家", "Bob"],
    ["西家", "Carol"],
    ["北家", "Dave"],
  ])
    await page.getByLabel(seat, { exact: true }).fill(name);
  await page.getByLabel("1枚あたりの単価（円）").fill("200");
  await page.getByRole("button", { name: "設定を保存" }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  const dialog = page.getByRole("dialog");
  await expect(page.getByLabel("Aliceの点数")).toHaveValue("0");
  await dialog.getByRole("button", { name: "結果を保存", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("合計");
  for (const [name, point, chip] of [
    ["Alice", "60000", "2"],
    ["Bob", "35000", "-1"],
    ["Carol", "15000", "0"],
    ["Dave", "-10000", "-1"],
  ]) {
    await page.getByLabel(`${name}の点数`).fill(point);
    await page.getByLabel(`${name}のチップ枚数`).fill(chip);
  }
  await dialog.getByRole("button", { name: "結果を保存", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".score-card").first()).toContainText("+70");
  await expect(page.locator(".score-card").first()).toContainText("100.0%");
  await expect(page.locator(".score-card").first()).toContainText("+400円");
  await page.reload();
  await expect(page.locator(".score-card").first()).toContainText("Alice");
  await expect(page.locator(".score-card").first()).toContainText("+70");
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByLabel("Aliceの点数").fill("50000");
  await page.getByLabel("Daveの点数").fill("0");
  await dialog.getByRole("button", { name: "結果を保存", exact: true }).click();
  await expect(page.locator(".history-card")).toContainText("50,000点");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV出力" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alice", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  for (const name of ["Alice", "Bob", "Carol", "Dave"])
    await page.getByLabel(`${name}の点数`).fill("25000");
  await dialog.getByRole("button", { name: "結果を保存", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".stat-strip")).toContainText("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

// The deployment path itself is part of the contract, including PWA resources.
test("GitHub Pages配下でReact・manifest・アイコン・Service Workerを配信", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "今日の対局", exact: true }),
  ).toBeVisible();
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .evaluate((element) => (element as HTMLLinkElement).href);
  expect(new URL(manifestUrl).pathname).toBe(
    "/MahjongScore/manifest.webmanifest",
  );
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(
    "/MahjongScore/",
  );
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe("/MahjongScore/");
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl);
    expect(url.pathname).toMatch(/^\/MahjongScore\/icon-/);
    const iconResponse = await page.request.get(url.href);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .evaluate((element) => (element as HTMLLinkElement).href);
  expect(new URL(appleIcon).pathname).toBe("/MahjongScore/icon-192.png");
  const registration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      script: registration.active?.scriptURL,
    };
  });
  expect(new URL(registration.scope).pathname).toBe("/MahjongScore/");
  expect(new URL(registration.script!).pathname).toBe("/MahjongScore/sw.js");
  expect(failed).toEqual([]);
});
