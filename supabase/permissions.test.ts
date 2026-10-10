import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { initialSettings } from "../src/storage/db";
it("実PostgreSQLエンジンで代表者権限・招待・更新競合・リンク失効を検証", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.uid'',true),'''')::uuid';grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`,
    );
    await db.exec(
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      `set role authenticated;set test.uid='11111111-1111-4111-8111-111111111111';`,
    );
    const snapshot = { version: 1, settings: initialSettings, rounds: [] };
    const created = await db.query<{
      room: { id: string; token: string; revision: number };
    }>("select public.create_score_room($1::jsonb) as room", [
      JSON.stringify(snapshot),
    ]);
    const room = created.rows[0].room;
    expect(room.revision).toBe(1);
    await db.exec(`set role anon;set test.uid='';`);
    const viewed = await db.query<{ room: { owner: boolean; data: unknown } }>(
      "select public.read_score_room($1::uuid,$2::uuid) as room",
      [room.id, room.token],
    );
    expect(viewed.rows[0].room).toMatchObject({ owner: false, data: snapshot });
    await expect(db.query("select * from public.score_rooms")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select public.update_score_room($1::uuid,1,$2::jsonb)", [
        room.id,
        JSON.stringify(snapshot),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.read_score_room($1::uuid,$2::uuid)", [
        room.id,
        "33333333-3333-4333-8333-333333333333",
      ]),
    ).rejects.toThrow(/Invalid invitation/);
    await db.exec(
      `set role authenticated;set test.uid='22222222-2222-4222-8222-222222222222';`,
    );
    await expect(
      db.query("select public.owned_score_room($1::uuid)", [room.id]),
    ).rejects.toThrow(/Owner required/);
    await expect(
      db.query("select public.update_score_room($1::uuid,1,$2::jsonb)", [
        room.id,
        JSON.stringify(snapshot),
      ]),
    ).rejects.toThrow(/Owner required/);
    await db.exec(`set test.uid='11111111-1111-4111-8111-111111111111';`);
    const updated = await db.query<{ room: { revision: number } }>(
      "select public.update_score_room($1::uuid,1,$2::jsonb) as room",
      [room.id, JSON.stringify(snapshot)],
    );
    expect(updated.rows[0].room.revision).toBe(2);
    await expect(
      db.query("select public.update_score_room($1::uuid,1,$2::jsonb)", [
        room.id,
        JSON.stringify(snapshot),
      ]),
    ).rejects.toThrow(/Revision conflict/);
    const rotated = await db.query<{ room: { token: string } }>(
      "select public.rotate_score_invite($1::uuid) as room",
      [room.id],
    );
    expect(rotated.rows[0].room.token).not.toBe(room.token);
    await expect(
      db.query("select public.read_score_room($1::uuid,$2::uuid)", [
        room.id,
        room.token,
      ]),
    ).rejects.toThrow(/Invalid invitation/);
    await expect(
      db.query("select public.create_score_room($1::jsonb)", [
        JSON.stringify({ version: 1, settings: {}, rounds: [] }),
      ]),
    ).rejects.toThrow(/Invalid payload/);
  } finally {
    await db.close();
  }
}, 30000);
