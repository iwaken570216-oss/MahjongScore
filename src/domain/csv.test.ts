import { it, expect } from "vitest";
import { exportCsv } from "./csv";
import { defaultRules } from "./score";
it("UTF-8 BOM、引用符、改行、数式注入を処理する", () => {
  const csv = exportCsv([
    {
      id: "1",
      date: "2026-10-10",
      players: ["=SUM(A1)", 'a,"b"', "c\nd", "普通"].map((name, i) => ({
        id: String(i),
        name,
      })),
      points: [40000, 30000, 20000, 10000],
      chips: [0, 0, 0, 0],
      rules: defaultRules,
      createdAt: 0,
    },
  ]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain('"\'=SUM(A1)"');
  expect(csv).toContain('"a,""b"""');
  expect(csv).toContain('"c\nd"');
  expect(csv).toContain('"-40"');
});
