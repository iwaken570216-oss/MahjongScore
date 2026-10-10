export type Rules = {
  startingPoints: number;
  returnPoints: number;
  uma: number[];
  tie: "split" | "seat";
  chipPoints?: number;
  /** Legacy monetary rule; retained only for old records. */
  chipPrice?: number;
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
  chipPoints: 1,
};
export function validateRules(r: Rules): string | null {
  if (
    ![
      r.startingPoints,
      r.returnPoints,
      r.chipPoints ?? r.chipPrice ?? 1,
      ...r.uma,
    ].every(Number.isFinite)
  )
    return "設定には有効な数値を入力してください。";
  if (
    r.startingPoints <= 0 ||
    r.returnPoints < r.startingPoints ||
    (r.chipPoints ?? r.chipPrice ?? 1) < 0
  )
    return "持ち点は正数、返し点は持ち点以上、チップポイントは0以上にしてください。";
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
      chipPoints:
        rules.chipPoints !== undefined ? chips[i] * rules.chipPoints : 0,
      chipAmount:
        rules.chipPoints === undefined ? chips[i] * (rules.chipPrice ?? 0) : 0,
      chipCount: chips[i],
      topShare: positions.includes(0) ? 1 / positions.length : 0,
    };
  });
}
export function totals(rounds: Round[], roster: Player[] = []) {
  type Row = Player & {
    score: number;
    chipPoints: number;
    chipAmount: number;
    chipCount: number;
    games: number;
    top: number;
    rankSum: number;
  };
  const empty = (player: Player): Row => ({
    ...player,
    score: 0,
    chipPoints: 0,
    chipAmount: 0,
    chipCount: 0,
    games: 0,
    top: 0,
    rankSum: 0,
  });
  const map = new Map<string, Row>(
    roster.map((player) => [player.id, empty(player)]),
  );
  rounds.forEach((round) =>
    calculate(round.points, round.chips, round.rules).forEach((result, i) => {
      const p = round.players[i];
      const row = map.get(p.id) ?? empty(p);
      row.score += result.score;
      row.chipPoints += result.chipPoints;
      row.chipAmount += result.chipAmount;
      row.chipCount += result.chipCount;
      row.games++;
      row.top += result.topShare;
      row.rankSum += result.rank;
      map.set(p.id, row);
    }),
  );
  const rows = [...map.values()].map((row) => ({
    ...row,
    totalScore: Math.round((row.score + row.chipPoints) * 1000) / 1000,
  }));
  const played = rows
    .filter((row) => row.games > 0)
    .sort((a, b) => b.totalScore - a.totalScore);
  const waiting = rows.filter((row) => row.games === 0);
  return [...played, ...waiting].map((row) => ({
    ...row,
    rank: row.games
      ? played.findIndex(
          (x) => Math.abs(x.totalScore - row.totalScore) < 0.000001,
        ) + 1
      : 0,
    averageRank: row.games ? row.rankSum / row.games : null,
    topRate: row.games ? (row.top / row.games) * 100 : 0,
  }));
}
/** Use the latest four seats, filling any removed members from the roster. */
export function participants(
  roster: Player[],
  previous: Player[] = [],
): Player[] {
  const ids = [...previous.map((p) => p.id), ...roster.map((p) => p.id)];
  return [...new Set(ids)]
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .slice(0, 4);
}
export function validateParticipants(players: Player[]): string | null {
  return players.length === 4 && new Set(players.map((p) => p.id)).size === 4
    ? null
    : "重複しない4人の参加者を選んでください。";
}
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
