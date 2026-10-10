import { test, expect, type BrowserContext } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  token = "22222222-2222-4222-8222-222222222222";
// HTTP fixtures are deliberately isolated from real Supabase. SQL permissions are
// separately executed against the PostgreSQL engine in supabase/permissions.test.ts.
test("代表者と招待客の別ブラウザで共有・閲覧制限・競合・失敗・ローカル保持", async ({
  browser,
  page,
  context,
}) => {
  let data: unknown = null,
    revision = 1,
    fail = false;
  async function mock(ctx: BrowserContext, owner: boolean) {
    await ctx.route("https://sync-test.supabase.co/**", async (route) => {
      const url = new URL(route.request().url());
      const body = route.request().postDataJSON() ?? {};
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "content-type": "application/json",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 200, headers, body: "" });
        return;
      }
      if (fail) {
        await route.fulfill({
          status: 503,
          headers,
          body: JSON.stringify({ message: "Unavailable" }),
        });
        return;
      }
      if (url.pathname.startsWith("/auth/")) {
        const jwt = [
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          Buffer.from(
            JSON.stringify({
              sub: id,
              exp: Math.floor(Date.now() / 1000) + 3600,
              role: "authenticated",
            }),
          ).toString("base64url"),
          "test-signature",
        ].join(".");
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            access_token: jwt,
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "mock-refresh",
            user: {
              id,
              is_anonymous: true,
              aud: "authenticated",
              role: "authenticated",
            },
          }),
        });
        return;
      }
      const rpc = url.pathname.split("/").pop();
      if (rpc === "create_score_room") {
        data = body.p_data;
      }
      if (rpc === "update_score_room") {
        if (!owner) {
          await route.fulfill({
            status: 403,
            headers,
            body: JSON.stringify({ code: "42501", message: "Owner required" }),
          });
          return;
        }
        if (body.p_revision !== revision) {
          await route.fulfill({
            status: 409,
            headers,
            body: JSON.stringify({
              code: "40001",
              message: "Revision conflict",
            }),
          });
          return;
        }
        data = body.p_data;
        revision++;
      }
      if (rpc === "read_score_room" && body.p_token !== token) {
        await route.fulfill({
          status: 404,
          headers,
          body: JSON.stringify({
            code: "P0002",
            message: "Invalid invitation",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ id, token, owner, revision, data }),
      });
    });
  }
  await mock(context, true);
  await page.goto("./");
  await page.getByRole("button", { name: "＋ 半荘の結果を入力" }).click();
  for (const [name, value] of [
    ["東家", "40000"],
    ["南家", "30000"],
    ["西家", "20000"],
    ["北家", "10000"],
  ]) {
    await page.getByLabel(`${name}の点数`).fill(value);
    await page.getByLabel(`${name}のチップ枚数`).fill("0");
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "結果を保存", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "共有ルームを作成", exact: true })
    .click();
  await page
    .getByRole("button", { name: "現在の記録をコピーして作成" })
    .click();
  await expect(page.getByLabel("閲覧用の招待リンク")).toBeVisible();
  const link = await page.getByLabel("閲覧用の招待リンク").inputValue();
  const lineLink = await page
    .getByRole("link", { name: "招待リンクをLINEで共有" })
    .getAttribute("href");
  expect(decodeURIComponent(lineLink!.split("?")[1])).toContain(link);
  expect(link).toContain(`#room=${id}`);
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await mock(guest, false);
  const viewer = await guest.newPage();
  await viewer.clock.install();
  await viewer.goto(link);
  await expect(viewer.locator(".score-card").first()).toContainText("+50");
  await expect(
    viewer.getByRole("button", { name: "＋ 半荘の結果を入力" }),
  ).toBeDisabled();
  await viewer.getByRole("button", { name: "履歴", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "修正", exact: true }),
  ).toBeDisabled();
  await expect(
    viewer.getByRole("button", { name: "削除", exact: true }),
  ).toBeDisabled();
  await viewer.getByRole("button", { name: "設定", exact: true }).click();
  await expect(
    viewer.getByLabel("プレイヤー1", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByLabel("東家の点数").fill("50000");
  await page.getByLabel("北家の点数").fill("0");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "結果を保存", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await viewer.getByRole("button", { name: "今日", exact: true }).click();
  await viewer.clock.fastForward(16000);
  await expect(viewer.locator(".score-card").first()).toContainText("+60");
  await page.getByRole("button", { name: "修正", exact: true }).click();
  revision++;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "結果を保存", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "他の画面",
  );
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByRole("button", { name: "今すぐ更新" }).click();
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByLabel("東家の点数").fill("60000");
  await page.getByLabel("北家の点数").fill("-10000");
  fail = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "結果を保存", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "同期に失敗",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  fail = true;
  await viewer.getByRole("button", { name: "今すぐ更新" }).click();
  await expect(viewer.getByRole("alert")).toContainText("同期に失敗");
  await expect(viewer.locator(".score-card").first()).toContainText("+60");
  fail = false;
  await page.getByRole("button", { name: "端末の記録に戻る" }).click();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.locator(".score-card").first()).toContainText("+50");
  await page.reload();
  await expect(page.locator(".score-card").first()).toContainText("+50");
  await guest.close();
});
