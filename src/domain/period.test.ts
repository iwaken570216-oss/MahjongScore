import { expect, test } from "vitest";
import { periodRounds } from "./period";
import { defaultRules, totals, type Round } from "./score";
import { lineShareUrl, standingsText } from "./share";
const players = ["東", "南", "西", "北"].map((name, i) => ({
  id: String(i),
  name,
}));
const round = (date: string, points = [40000, 30000, 20000, 10000]): Round => ({
  id: date,
  date,
  players,
  points,
  chips: [0, 0, 0, 0],
  rules: defaultRules,
  createdAt: 0,
});
test("月と年の境界を正しく絞り込み、不正な期間は集計しない", () => {
  const rounds = [
    "2025-12-31",
    "2026-01-01",
    "2026-01-31",
    "2026-02-01",
    "2027-01-01",
  ].map((date) => round(date));
  expect(periodRounds(rounds, "month", "2026-01").map((r) => r.date)).toEqual([
    "2026-01-01",
    "2026-01-31",
  ]);
  expect(periodRounds(rounds, "year", "2026")).toHaveLength(3);
  expect(periodRounds(rounds, "month", "")).toEqual([]);
});
test("休んだ人を分母に含めず、同点ルールの順位から平均を計算", () => {
  const rows = totals(
    [round("2026-01-01"), round("2026-01-02", [30000, 30000, 20000, 20000])],
    [...players, { id: "rest", name: "休み" }],
  );
  expect(rows.find((r) => r.id === "1")?.averageRank).toBe(1.5);
  expect(rows.find((r) => r.id === "rest")?.averageRank).toBeNull();
  expect(rows.find((r) => r.id === "0")?.topRate).toBe(75);
});
test("LINE共有の日本語・改行・招待リンクのフラグメントを保持", () => {
  const text = "雀録\nhttps://example.com/#room=a&invite=b";
  expect(decodeURIComponent(lineShareUrl(text).split("?")[1])).toBe(text);
  expect(standingsText("月間", totals([round("2026-01-01")]))).toContain(
    "平均順位1.00",
  );
});
