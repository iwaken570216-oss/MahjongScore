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
it("旧設定を1pt初期値へ移行し、過去の金額と参加者IDは維持する", async () => {
  const { chipPoints: _, ...rules } = defaultRules;
  const oldRules = { ...rules, chipPrice: 100 };
  const legacy: Round = {
    id: "legacy",
    date: "2026-10-10",
    players: initialSettings.players,
    points: [40000, 30000, 20000, 10000],
    chips: [2, -1, 0, -1],
    rules: oldRules,
    createdAt: 1,
  };
  await saveSettings({ ...initialSettings, rules: oldRules });
  await saveRound(legacy);
  const data = await load();
  expect(data.settings?.rules.chipPoints).toBe(1);
  expect(data.settings?.rules.chipPrice).toBeUndefined();
  expect(data.settings?.players).toEqual(initialSettings.players);
  expect(data.rounds.find((r) => r.id === "legacy")).toEqual(legacy);
  await removeRound("legacy");
});
