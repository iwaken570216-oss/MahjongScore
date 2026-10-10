export type Rules = {
  startingPoints: number;
  returnPoints: number;
  uma: number[];
  tie: "split" | "seat";
  chipPrice: number;
};
export type Player = { id: string; name: string };
export type Round = {
  id: string;
  date: string;
  players: Player[];
  points: number[];
  chips: number[];
  rules: Rules;
  createdAt: number;
};
export const defaultRules: Rules = {
  startingPoints: 25000,
  returnPoints: 30000,
  uma: [20, 10, -10, -20],
  tie: "split",
  chipPrice: 100,
};
export function validateRules(r: Rules): string | null {
  if (
    ![r.startingPoints, r.returnPoints, r.chipPrice, ...r.uma].every(
      Number.isFinite,
    )
  )
    return "設定には有効な数値を入力してください。";
  if (
    r.startingPoints <= 0 ||
    r.returnPoints < r.startingPoints ||
    r.chipPrice < 0
  )
    return "持ち点は正数、返し点は持ち点以上、チップ単価は0以上にしてください。";
  if (
    r.uma.length !== 4 ||
    Math.abs(r.uma.reduce((a, b) => a + b, 0)) > 0.000001
  )
    return "ウマの合計を0にしてください。";
  return null;
}
export function calculate(points: number[], chips: number[], rules: Rules) {
  const error = validateRules(rules);
  if (error) throw new Error(error);
  if (
    points.length !== 4 ||
    chips.length !== 4 ||
    ![...points, ...chips].every(Number.isFinite) ||
    !chips.every(Number.isInteger)
  )
    throw new Error("4人分の有効な点数と整数のチップ枚数が必要です。");
  const order = points
    .map((_, i) => i)
    .sort((a, b) => points[b] - points[a] || a - b);
  const oka = (4 * (rules.returnPoints - rules.startingPoints)) / 1000;
  return points.map((point, i) => {
    const positions =
      rules.tie === "seat"
        ? [order.indexOf(i)]
        : order
            .map((p, pos) => (points[p] === point ? pos : -1))
            .filter((pos) => pos >= 0);
    const rank = positions[0] + 1;
    const bonus =
      positions.reduce(
        (sum, pos) => sum + rules.uma[pos] + (pos === 0 ? oka : 0),
        0,
      ) / positions.length;
    return {
      rank,
      score:
        Math.round(((point - rules.returnPoints) / 1000 + bonus) * 1000) / 1000,
      chipAmount: chips[i] * rules.chipPrice,
      topShare: positions.includes(0) ? 1 / positions.length : 0,
    };
  });
}
export function totals(rounds: Round[]) {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      score: number;
      chipAmount: number;
      games: number;
      top: number;
    }
  >();
  rounds.forEach((round) =>
    calculate(round.points, round.chips, round.rules).forEach((result, i) => {
      const p = round.players[i];
      const row = map.get(p.id) ?? {
        ...p,
        score: 0,
        chipAmount: 0,
        games: 0,
        top: 0,
      };
      row.score += result.score;
      row.chipAmount += result.chipAmount;
      row.games++;
      row.top += result.topShare;
      map.set(p.id, row);
    }),
  );
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map((r, i, rows) => ({
      ...r,
      rank: rows.findIndex((x) => Math.abs(x.score - r.score) < 0.000001) + 1,
      topRate: (r.top / r.games) * 100,
    }));
}
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
