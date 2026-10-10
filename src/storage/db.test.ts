import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  load,
  saveRound,
  removeRound,
  saveSettings,
  initialSettings,
} from "./db";
import { defaultRules, type Round } from "../domain/score";
it("設定・対局を保存、読み込み、修正、削除できる", async () => {
  const r: Round = {
    id: "test",
    date: "2026-10-10",
    players: initialSettings.players,
    points: [40000, 30000, 20000, 10000],
    chips: [0, 0, 0, 0],
    rules: defaultRules,
    createdAt: 1,
  };
  await saveSettings(initialSettings);
  await saveRound(r);
  expect((await load()).settings).toEqual(initialSettings);
  expect((await load()).rounds).toEqual([r]);
  await saveRound({ ...r, points: [50000, 30000, 20000, 0] });
  expect((await load()).rounds[0].points[0]).toBe(50000);
  await removeRound(r.id);
  expect((await load()).rounds).toEqual([]);
});
