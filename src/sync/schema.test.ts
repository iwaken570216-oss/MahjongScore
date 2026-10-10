import { it, expect } from "vitest";
import { initialSettings } from "../storage/db";
import { inviteSelection, parseSnapshot } from "./schema";
it("ルームをIDと招待トークンで識別し不正リンクを拒否", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    token = "22222222-2222-4222-8222-222222222222";
  expect(inviteSelection(`#room=${id}&invite=${token}`)).toEqual({ id, token });
  expect(inviteSelection("#room=invalid&invite=invalid")).toBeNull();
});
it("共有データの人数・重複・壊れた記録を拒否", () => {
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
