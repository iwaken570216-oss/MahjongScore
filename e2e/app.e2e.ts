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
    ["プレイヤー1", "Alice"],
    ["プレイヤー2", "Bob"],
    ["プレイヤー3", "Carol"],
    ["プレイヤー4", "Dave"],
  ])
    await page.getByLabel(seat, { exact: true }).fill(name);
  await page.getByLabel("1枚あたりのポイント").fill("200");
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
  await expect(page.locator(".score-card").first()).toContainText("+400 pt");
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

test("6人登録・5人交代・休みの成績・チップポイントの別集計", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page
      .getByLabel(`プレイヤー${i + 1}`, { exact: true })
      .fill(["Alice", "Bob", "Carol", "Dave"][i]);
  await page.getByRole("button", { name: "＋ プレイヤーを追加" }).click();
  await page.getByLabel("プレイヤー5", { exact: true }).fill("Eve");
  await page.getByRole("button", { name: "＋ プレイヤーを追加" }).click();
  await page.getByLabel("プレイヤー6", { exact: true }).fill("Frank");
  await page.getByLabel("1枚あたりのポイント").fill("2.5");
  await page.getByRole("button", { name: "設定を保存" }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page.getByRole("button", { name: "今日", exact: true }).click();
  async function record(names: string[]) {
    for (let i = 0; i < 4; i++) {
      await page
        .getByLabel(`${names[i]}の点数`)
        .fill(["40000", "30000", "20000", "10000"][i]);
      await page
        .getByLabel(`${names[i]}のチップ枚数`)
        .fill(["-100", "100", "0", "0"][i]);
    }
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "結果を保存", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  await expect(page.getByLabel("東家の参加者")).toHaveValue("player-0");
  await record(["Alice", "Bob", "Carol", "Dave"]);
  const alice = page
    .locator(".score-card")
    .filter({ has: page.getByRole("heading", { name: "Alice", exact: true }) });
  await expect(alice).toContainText("+50");
  await expect(alice).toContainText("-250 pt");
  await expect(alice).toContainText("100.0%");
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  await page.getByLabel("東家の参加者").selectOption({ label: "Eve" });
  await expect(page.getByRole("dialog")).toContainText("休み: Alice、Frank");
  await record(["Eve", "Bob", "Carol", "Dave"]);
  await expect(alice).toContainText("· 1回");
  await expect(alice).toContainText("100.0%");
  await expect(
    page
      .locator(".score-card")
      .filter({ has: page.getByRole("heading", { name: "Bob", exact: true }) }),
  ).toContainText("· 2回");
  await expect(
    page
      .locator(".score-card")
      .filter({
        has: page.getByRole("heading", { name: "Frank", exact: true }),
      }),
  ).toContainText("· 0回");
  await page.reload();
  await expect(alice).toContainText("+50");
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  await expect(page.getByLabel("東家の参加者")).toHaveValue(
    (await page
      .getByLabel("東家の参加者")
      .locator("option", { hasText: "Eve" })
      .getAttribute("value")) ?? "",
  );
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(2);
  await expect(page.locator(".history-card").first()).toContainText("Eve");
  await page
    .locator(".history-card")
    .last()
    .getByRole("button", { name: "修正", exact: true })
    .click();
  await expect(page.getByLabel("Aliceの点数")).toHaveValue("40000");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/rotation-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
