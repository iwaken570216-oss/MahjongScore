import { it, expect } from "vitest";
import { participants, validateParticipants } from "./score";
const roster = ["A", "B", "C", "D", "E"].map((id) => ({ id, name: id }));
it("参加者4人を席順で選び、前回の席を再利用する", () => {
  expect(participants(roster)).toEqual(roster.slice(0, 4));
  expect(participants(roster, [roster[4], ...roster.slice(1, 4)])).toEqual([
    roster[4],
    ...roster.slice(1, 4),
  ]);
  expect(
    participants(roster, [
      { id: "removed", name: "旧参加者" },
      ...roster.slice(1, 4),
    ]).map((p) => p.id),
  ).toEqual(["B", "C", "D", "A"]);
});
it("参加者の重複や不足を拒否する", () => {
  expect(
    validateParticipants([roster[0], roster[0], roster[2], roster[3]]),
  ).toBeTruthy();
  expect(validateParticipants(roster)).toBeTruthy();
  expect(validateParticipants(roster.slice(0, 4))).toBeNull();
});
