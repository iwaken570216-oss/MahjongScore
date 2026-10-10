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
export async function load() {
  const db = await database();
  return {
    rounds: (await db.getAll("rounds")) as Round[],
    settings: (await db.get("settings", "current")) as Settings | undefined,
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
