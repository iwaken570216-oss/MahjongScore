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
    expect(r.map((x) => x.chipPoints)).toEqual([2, -1, 0, -1]);
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
    expect(validateRules({ ...defaultRules, chipPoints: -1 })).toBeTruthy();
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
    chipPoints: 2,
  });
  expect(totals([round]).map((x) => x.rank)).toEqual([1, 2, 3, 4]);
});

it("チップは半荘順位・素点スコアを変えない", () => {
  const result = calculate([40000, 30000, 20000, 10000], [-100, 100, 0, 0], {
    ...defaultRules,
    chipPoints: 2.5,
  });
  expect(result.map((r) => r.chipPoints)).toEqual([-250, 250, 0, 0]);
  expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  expect(result.map((r) => r.score)).toEqual([50, 10, -20, -40]);
});
it("5人交代でもID別に集計し休んだ半荘を分母に含めない", () => {
  const roster = ["A", "B", "C", "D", "E", "F"].map((id) => ({ id, name: id }));
  const first = {
    ...round,
    players: roster.slice(0, 4),
    points: [40000, 30000, 20000, 10000],
  };
  const second = {
    ...first,
    id: "r2",
    players: [roster[4], ...roster.slice(1, 4)],
  };
  const rows = totals([first, second], roster);
  expect(rows.find((r) => r.id === "A")).toMatchObject({
    games: 1,
    score: 50,
    topRate: 100,
  });
  expect(rows.find((r) => r.id === "E")).toMatchObject({
    games: 1,
    score: 50,
    topRate: 100,
  });
  expect(rows.find((r) => r.id === "B")).toMatchObject({
    games: 2,
    score: 20,
    topRate: 0,
  });
  expect(rows.find((r) => r.id === "F")).toMatchObject({
    games: 0,
    rank: 0,
    topRate: 0,
  });
});
it("旧金額記録をポイントへ誤変換しない", () => {
  const { chipPoints: _, ...oldRules } = defaultRules;
  const result = calculate([40000, 30000, 20000, 10000], [2, -1, 0, -1], {
    ...oldRules,
    chipPrice: 100,
  });
  expect(result[0]).toMatchObject({
    chipPoints: 0,
    chipAmount: 200,
    chipCount: 2,
    score: 50,
  });
});

it("本日の順位はチップ込み合計で逆転し、トップ率は素点のまま", () => {
  const rows = totals([
    {
      ...round,
      points: [40000, 30000, 20000, 10000],
      chips: [-100, 100, 0, 0],
      rules: { ...defaultRules, chipPoints: 2.5 },
    },
  ]);
  expect(rows[0]).toMatchObject({
    id: "B",
    score: 10,
    chipPoints: 250,
    totalScore: 260,
    rank: 1,
    topRate: 0,
  });
  expect(rows.find((r) => r.id === "A")).toMatchObject({
    score: 50,
    chipPoints: -250,
    totalScore: -200,
    rank: 4,
    topRate: 100,
  });
});
it("チップ込み合計が同じなら同順位、未参加者は順位なし", () => {
  const rows = totals(
    [
      {
        ...round,
        points: [40000, 30000, 20000, 10000],
        chips: [-20, 20, 0, 0],
      },
    ],
    [...round.players, { id: "E", name: "E" }],
  );
  expect(rows.slice(0, 2).map((r) => r.rank)).toEqual([1, 1]);
  expect(rows.slice(0, 2).map((r) => r.totalScore)).toEqual([30, 30]);
  expect(rows.find((r) => r.id === "E")).toMatchObject({
    games: 0,
    rank: 0,
    totalScore: 0,
  });
});
it("旧金額は合計スコアに加算しない", () => {
  const { chipPoints: _, ...rules } = defaultRules;
  const rows = totals([
    {
      ...round,
      points: [40000, 30000, 20000, 10000],
      chips: [-100, 100, 0, 0],
      rules: { ...rules, chipPrice: 100 },
    },
  ]);
  expect(rows[0]).toMatchObject({
    id: "A",
    score: 50,
    totalScore: 50,
    chipAmount: -10000,
  });
});
