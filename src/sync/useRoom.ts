import { useEffect, useRef, useState } from "react";
import {
  createRoom,
  readRoom,
  updateRoom,
  rotateInvite,
  syncConfigured,
  type Room,
} from "./client";
import {
  inviteSelection,
  parseSelection,
  type Selection,
  type Snapshot,
} from "./schema";
const STORAGE = "janroku-active-room";
function initial() {
  const invite = inviteSelection(location.hash);
  if (invite) return invite;
  try {
    return parseSelection(JSON.parse(localStorage.getItem(STORAGE) ?? "null"));
  } catch {
    return null;
  }
}
export function useRoom(ready: boolean) {
  const [selection, setSelection] = useState<Selection | null>(initial),
    [room, setRoom] = useState<Room | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [connected, setConnected] = useState(false),
    [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const generation = useRef(0),
    roomRef = useRef<Room | null>(null),
    inFlight = useRef<number | null>(null);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  function persist(next: Selection | null) {
    try {
      if (next) localStorage.setItem(STORAGE, JSON.stringify(next));
      else localStorage.removeItem(STORAGE);
    } catch {
      /* Current session remains usable. */
    }
  }
  const errorText = (e: unknown) =>
    e instanceof Error ? e.message : "ルームに接続できませんでした。";
  async function refresh() {
    if (
      !selection ||
      !syncConfigured ||
      inFlight.current === generation.current
    )
      return;
    const current = generation.current;
    inFlight.current = current;
    try {
      const fresh = await readRoom(selection);
      if (current !== generation.current) return;
      setRoom((old) =>
        old?.id === fresh.id && old.revision === fresh.revision ? old : fresh,
      );
      setConnected(true);
      setError("");
      setUpdatedAt(Date.now());
    } catch (e) {
      if (current === generation.current) {
        setConnected(false);
        setError(errorText(e));
      }
    } finally {
      if (inFlight.current === current) inFlight.current = null;
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!ready) return;
    generation.current++;
    setRoom(null);
    roomRef.current = null;
    setConnected(false);
    setError("");
    if (!selection) return;
    if (!syncConfigured) {
      setError(
        "招待されたルームを開くには、アプリのSupabase接続設定が必要です。",
      );
      return;
    }
    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [selection?.id, selection?.token, ready]);
  useEffect(() => {
    const changed = () => {
      const invite = inviteSelection(location.hash);
      if (invite) {
        persist(invite);
        setSelection(invite);
      }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  async function create(snapshot: Snapshot) {
    setLoading(true);
    setError("");
    try {
      const created = await createRoom(snapshot);
      const next = { id: created.id };
      persist(next);
      history.replaceState(null, "", location.pathname + location.search);
      setSelection(next);
      return created;
    } catch (e) {
      setError(errorText(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }
  async function commit(snapshot: Snapshot, revision: number) {
    const current = roomRef.current;
    if (!current?.owner) throw new Error("代表者だけが変更できます。");
    const fresh = await updateRoom(current, snapshot, revision);
    setRoom(fresh);
    roomRef.current = fresh;
    setConnected(true);
    setUpdatedAt(Date.now());
  }
  async function renew() {
    const current = roomRef.current;
    if (!current?.owner) return;
    setLoading(true);
    try {
      const fresh = await rotateInvite(current);
      setRoom(fresh);
      roomRef.current = fresh;
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  function leave() {
    generation.current++;
    persist(null);
    history.replaceState(null, "", location.pathname + location.search);
    setSelection(null);
    setRoom(null);
    roomRef.current = null;
    setError("");
    setConnected(false);
    setUpdatedAt(null);
  }
  return {
    room,
    selected: Boolean(selection),
    error,
    loading,
    connected,
    updatedAt,
    create,
    commit,
    refresh,
    renew,
    leave,
    configured: syncConfigured,
    readOnly: Boolean(selection) && (!room?.owner || !connected),
  };
}
