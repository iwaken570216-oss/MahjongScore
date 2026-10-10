import { calculate, type Round } from "./score";
const cell = (value: string | number) => {
  const s = String(value);
  return (
    '"' +
    (/^[=+\-@\t\r]/.test(s) && typeof value === "string"
      ? "'" + s
      : s
    ).replaceAll('"', '""') +
    '"'
  );
};
export function exportCsv(rounds: Round[]) {
  const rows: (string | number)[][] = [
    [
      "対局ID",
      "日付",
      "プレイヤー",
      "席順",
      "点数",
      "順位",
      "スコア",
      "チップ枚数",
      "チップポイント",
      "旧チップ金額",
      "持ち点",
      "返し点",
      "ウマ",
      "同点ルール",
      "1枚あたりポイント",
      "旧チップ単価",
    ],
  ];
  rounds.forEach((r) =>
    calculate(r.points, r.chips, r.rules).forEach((s, i) =>
      rows.push([
        r.id,
        r.date,
        r.players[i].name,
        i + 1,
        r.points[i],
        s.rank,
        s.score,
        r.chips[i],
        s.chipPoints,
        s.chipAmount,
        r.rules.startingPoints,
        r.rules.returnPoints,
        r.rules.uma.join("/"),
        r.rules.tie,
        r.rules.chipPoints ?? "",
        r.rules.chipPrice ?? "",
      ]),
    ),
  );
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
