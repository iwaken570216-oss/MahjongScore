import { openDB } from "idb";
import {
  defaultRules,
  type Round,
  type Rules,
  type Player,
} from "../domain/score";
const database = () =>
  openDB("mahjong-score", 1, {
    upgrade(db) {
      db.createObjectStore("rounds", { keyPath: "id" });
      db.createObjectStore("settings");
    },
  });
export type Settings = { players: Player[]; rules: Rules };
/** Upgrade editable settings without rewriting historical monetary records. */
export function normalizeSettings(settings: Settings): Settings {
  const { chipPrice: _legacy, ...rules } = settings.rules;
  return {
    ...settings,
    rules: { ...rules, chipPoints: rules.chipPoints ?? 1 },
  };
}
export async function load() {
  const db = await database();
  const settings = (await db.get("settings", "current")) as
    Settings | undefined;
  return {
    rounds: (await db.getAll("rounds")) as Round[],
    settings: settings ? normalizeSettings(settings) : undefined,
  };
}
export async function saveRound(round: Round) {
  const db = await database();
  await db.put("rounds", round);
}
export async function removeRound(id: string) {
  const db = await database();
  await db.delete("rounds", id);
}
export async function saveSettings(settings: Settings) {
  const db = await database();
  await db.put("settings", settings, "current");
}
export const initialSettings: Settings = {
  players: ["東家", "南家", "西家", "北家"].map((name, i) => ({
    id: `player-${i}`,
    name,
  })),
  rules: defaultRules,
};

/** Merge a validated backup atomically, retaining unrelated local rounds. */
export async function importBackup(data: {
  settings: Settings;
  rounds: Round[];
}) {
  const db = await database();
  const tx = db.transaction(["settings", "rounds"], "readwrite");
  await tx.objectStore("settings").put(data.settings, "current");
  for (const round of data.rounds) await tx.objectStore("rounds").put(round);
  await tx.done;
  return load();
}
