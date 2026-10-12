import { it, expect } from "vitest";
import { initialSettings } from "../storage/db";
import { parseSnapshot } from "./schema";
it("バックアップデータの人数・重複・壊れた記録を拒否", () => {
  const snapshot = { version: 1, settings: initialSettings, rounds: [] };
  expect(parseSnapshot(snapshot)).toEqual(snapshot);
  expect(() =>
    parseSnapshot({
      ...snapshot,
      settings: { ...initialSettings, players: [initialSettings.players[0]] },
    }),
  ).toThrow();
  expect(() =>
    parseSnapshot({ ...snapshot, rounds: [{ id: "broken" }] }),
  ).toThrow();
});
