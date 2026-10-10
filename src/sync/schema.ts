import { z } from "zod";
import {
  calculate,
  validateParticipants,
  validateRules,
} from "../domain/score";
import type { Settings } from "../storage/db";
import type { Round } from "../domain/score";
const player = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(20),
});
const rules = z
  .object({
    startingPoints: z.number().finite(),
    returnPoints: z.number().finite(),
    uma: z.array(z.number().finite()).length(4),
    tie: z.enum(["split", "seat"]),
    chipPoints: z.number().finite().nonnegative().optional(),
    chipPrice: z.number().finite().nonnegative().optional(),
  })
  .refine((r) => !validateRules(r));
const settings = z
  .object({ players: z.array(player).min(4).max(100), rules })
  .refine(
    (s) =>
      new Set(s.players.map((p) => p.id)).size === s.players.length &&
      new Set(s.players.map((p) => p.name)).size === s.players.length,
  );
const round = z
  .object({
    id: z.string().min(1).max(100),
    date: z.iso.date(),
    players: z.array(player).length(4),
    points: z.array(z.number().int()).length(4),
    chips: z.array(z.number().int()).length(4),
    rules,
    createdAt: z.number().nonnegative(),
  })
  .refine(
    (r) =>
      !validateParticipants(r.players) &&
      r.points.reduce((a, b) => a + b, 0) === r.rules.startingPoints * 4 &&
      r.chips.reduce((a, b) => a + b, 0) === 0,
  );
export type Snapshot = { version: 1; settings: Settings; rounds: Round[] };
const schema = z
  .object({ version: z.literal(1), settings, rounds: z.array(round).max(2000) })
  .refine((s) => new Set(s.rounds.map((r) => r.id)).size === s.rounds.length);
export function parseSnapshot(value: unknown): Snapshot {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      "共有データの形式が正しくありません。代表者に確認してください。",
    );
  result.data.rounds.forEach((r) => calculate(r.points, r.chips, r.rules));
  return result.data;
}
export type Selection = { id: string; token?: string };
const selectionSchema = z.object({ id: z.uuid(), token: z.uuid().optional() });
export function parseSelection(value: unknown): Selection | null {
  const result = selectionSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function inviteSelection(hash: string): Selection | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return parseSelection({
    id: params.get("room"),
    token: params.get("invite") ?? undefined,
  });
}
