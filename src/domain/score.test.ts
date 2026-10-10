import { describe, it, expect } from "vitest";
import {
  calculate,
  defaultRules,
  totals,
  validateRules,
  type Round,
} from "./score";
describe("半荘の計算", () => {
  it("返し点、ウマ、オカを適用し合計0になる", () => {
    const r = calculate(
      [40000, 30000, 20000, 10000],
      [2, -1, 0, -1],
      defaultRules,
    );
    expect(r.map((x) => x.score)).toEqual([50, 10, -20, -40]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(r.reduce((s, x) => s + x.score, 0)).toBe(0);
    expect(r.map((x) => x.chipAmount)).toEqual([200, -100, 0, -100]);
  });
  it("箱下を計算できる", () => {
    const r = calculate(
      [60000, 35000, 15000, -10000],
      [0, 0, 0, 0],
      defaultRules,
    );
    expect(r[3].score).toBe(-60);
    expect(r.reduce((s, x) => s + x.score, 0)).toBe(0);
  });
  it("同点トップのウマとオカを均等分配", () => {
    const r = calculate(
      [35000, 35000, 20000, 10000],
      [0, 0, 0, 0],
      defaultRules,
    );
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3, 4]);
    expect(r.map((x) => x.score)).toEqual([30, 30, -20, -40]);
    expect(r[0].topShare).toBe(0.5);
  });
  it("全員同点を均等分配", () => {
    const r = calculate(
      [25000, 25000, 25000, 25000],
      [0, 0, 0, 0],
      defaultRules,
    );
    expect(r.map((x) => x.score)).toEqual([0, 0, 0, 0]);
    expect(r.map((x) => x.topShare)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
  it("席順優先", () => {
    const r = calculate([25000, 25000, 25000, 25000], [0, 0, 0, 0], {
      ...defaultRules,
      tie: "seat",
    });
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(r.map((x) => x.score)).toEqual([35, 5, -15, -25]);
    expect(r[0].topShare).toBe(1);
  });
  it("任意の持ち点と返し点に対応", () => {
    const r = calculate([40000, 35000, 25000, 20000], [0, 0, 0, 0], {
      ...defaultRules,
      startingPoints: 30000,
      returnPoints: 35000,
    });
    expect(r.map((x) => x.score)).toEqual([45, 10, -20, -35]);
  });
  it("下位の同点ではオカを配らない", () => {
    const r = calculate(
      [40000, 25000, 25000, 10000],
      [0, 0, 0, 0],
      defaultRules,
    );
    expect(r.map((x) => x.score)).toEqual([50, -5, -5, -40]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });
  it("無効なルールと入力を拒否", () => {
    expect(
      validateRules({ ...defaultRules, uma: [20, 10, -10, -10] }),
    ).toBeTruthy();
    expect(validateRules({ ...defaultRules, chipPrice: -1 })).toBeTruthy();
    expect(() =>
      calculate([NaN, 0, 0, 0], [0, 0, 0, 0], defaultRules),
    ).toThrow();
    expect(() =>
      calculate([0, 0, 0, 0], [0.5, 0, 0, 0], defaultRules),
    ).toThrow();
  });
});
const round: Round = {
  id: "r1",
  date: "2026-10-10",
  players: ["A", "B", "C", "D"].map((id) => ({ id, name: id })),
  points: [35000, 35000, 20000, 10000],
  chips: [1, -1, 0, 0],
  rules: defaultRules,
  createdAt: 1,
};
it("累計順位とトップ率、保存時ルールを使って集計", () => {
  const rows = totals([
    round,
    { ...round, id: "r2", points: [40000, 30000, 20000, 10000] },
  ]);
  expect(rows[0]).toMatchObject({
    name: "A",
    score: 80,
    rank: 1,
    topRate: 75,
    games: 2,
    chipAmount: 200,
  });
  expect(totals([round]).map((x) => x.rank)).toEqual([1, 1, 3, 4]);
});
