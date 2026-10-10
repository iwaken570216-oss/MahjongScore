import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseSnapshot, type Selection, type Snapshot } from "./schema";
export type Room = {
  id: string;
  revision: number;
  owner: boolean;
  token: string;
  data: Snapshot;
};
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const syncConfigured = Boolean(url && key);
let client: SupabaseClient | undefined;
function api() {
  if (!syncConfigured) throw new Error("Supabaseの接続設定が必要です。");
  return (client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "janroku-owner-session",
    },
  }));
}
function failure(error: { code?: string; message: string }) {
  if (error.code === "40001")
    return new Error(
      "他の画面で記録が更新されました。最新の内容を確認して入力し直してください。",
    );
  if (error.code === "P0002")
    return new Error("ルームが見つからないか、招待リンクが無効です。");
  if (error.code === "42501")
    return new Error(
      "代表者の認証が必要です。作成時と同じブラウザで開いてください。",
    );
  return new Error(
    "同期に失敗しました。通信とSupabaseの設定を確認してください。",
  );
}
function decode(value: unknown): Room {
  const r = value as Record<string, unknown>;
  if (
    !r ||
    typeof r.id !== "string" ||
    typeof r.revision !== "number" ||
    !Number.isInteger(r.revision) ||
    typeof r.owner !== "boolean" ||
    typeof r.token !== "string"
  )
    throw new Error("ルーム情報が正しくありません。");
  return {
    id: r.id,
    revision: r.revision,
    owner: r.owner,
    token: r.token,
    data: parseSnapshot(r.data),
  };
}
export async function createRoom(snapshot: Snapshot): Promise<Room> {
  parseSnapshot(snapshot);
  const auth = await api().auth.getSession();
  if (auth.error) throw failure(auth.error);
  if (!auth.data.session) {
    const signIn = await api().auth.signInAnonymously();
    if (signIn.error) throw failure(signIn.error);
  }
  const { data, error } = await api().rpc("create_score_room", {
    p_data: snapshot,
  });
  if (error) throw failure(error);
  return decode(data);
}
export async function readRoom(selection: Selection): Promise<Room> {
  const { data, error } = await api().rpc(
    selection.token ? "read_score_room" : "owned_score_room",
    selection.token
      ? { p_id: selection.id, p_token: selection.token }
      : { p_id: selection.id },
  );
  if (error) throw failure(error);
  return decode(data);
}
export async function updateRoom(
  room: Room,
  snapshot: Snapshot,
  revision: number,
): Promise<Room> {
  if (!room.owner) throw new Error("このルームは閲覧専用です。");
  parseSnapshot(snapshot);
  const { data, error } = await api().rpc("update_score_room", {
    p_id: room.id,
    p_revision: revision,
    p_data: snapshot,
  });
  if (error) throw failure(error);
  return decode(data);
}
export async function rotateInvite(room: Room): Promise<Room> {
  if (!room.owner) throw new Error("このルームは閲覧専用です。");
  const { data, error } = await api().rpc("rotate_score_invite", {
    p_id: room.id,
  });
  if (error) throw failure(error);
  return decode(data);
}
export function inviteUrl(room: Room) {
  const url = new URL(location.href);
  url.hash = new URLSearchParams({
    room: room.id,
    invite: room.token,
  }).toString();
  return url.href;
}
