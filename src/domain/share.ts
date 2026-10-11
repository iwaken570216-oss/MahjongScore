import { totals } from "./score";
/** LINE opens a draft; the user chooses recipients and sends it. */
export function lineShareUrl(text: string) {
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}
export function standingsText(title: string, rows: ReturnType<typeof totals>) {
  return [
    title,
    ...rows
      .filter((row) => row.games > 0)
      .map(
        (row) =>
          `${row.rank}位 ${row.name}：${row.totalScore > 0 ? "+" : ""}${row.totalScore} pt（${row.games}回・トップ率${row.topRate.toFixed(1)}%・平均順位${row.averageRank!.toFixed(2)}）`,
      ),
  ].join("\n");
}
