import type { Round } from "./score";
/** Stored dates are local YYYY-MM-DD dates, so no UTC conversion is needed. */
export function periodRounds(
  rounds: Round[],
  period: "month" | "year",
  value: string,
) {
  if (!(period === "month" ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}$/).test(value))
    return [];
  return rounds.filter((round) => round.date.startsWith(`${value}-`));
}
