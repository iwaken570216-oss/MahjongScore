import { useRoom } from "./sync/useRoom";
import RoomPanel from "./sync/RoomPanel";
import { useEffect, useState } from "react";
import {
  calculate,
  localDate,
  totals,
  validateRules,
  participants,
  validateParticipants,
  type Round,
} from "./domain/score";
import { exportCsv } from "./domain/csv";
import {
  initialSettings,
  load,
  saveSettings,
  saveRound,
  removeRound,
  type Settings,
} from "./storage/db";
const number = (v: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 }).format(v);
const signed = (v: number) => `${v > 0 ? "+" : ""}${number(v)}`;
const seats = ["東", "南", "西", "北"];
export default function App() {
  const [localSettings, setSettings] = useState<Settings>(initialSettings),
    [draft, setDraft] = useState<Settings>(initialSettings);
  const [localRounds, setRounds] = useState<Round[]>([]),
    [tab, setTab] = useState<"today" | "history" | "settings">("today");
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Round | null>(null),
    [points, setPoints] = useState<string[]>(["0", "0", "0", "0"]),
    [chips, setChips] = useState<string[]>(["0", "0", "0", "0"]);
  const [date, setDate] = useState(localDate()),
    [filter, setFilter] = useState(""),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const shared = useRoom(ready);
  const settings = shared.room?.data.settings ?? localSettings;
  const rounds = shared.room?.data.rounds ?? localRounds;
  const [editRevision, setEditRevision] = useState(0),
    [draftRevision, setDraftRevision] = useState(0),
    [deleteRevision, setDeleteRevision] = useState(0);
  useEffect(() => {
    setDraft(settings);
    setDraftRevision(shared.room?.revision ?? 0);
    setEditing(null);
    setDeleteId(null);
  }, [shared.room?.id, shared.selected]);
  useEffect(() => {
    load()
      .then((data) => {
        setRounds(data.rounds);
        if (data.settings) {
          setSettings(data.settings);
          setDraft(data.settings);
        }
        setReady(true);
      })
      .catch(() =>
        setError(
          "端末の保存領域を開けませんでした。ブラウザの設定を確認して再読み込みしてください。",
        ),
      );
  }, []);
  useEffect(() => {
    if (!editing && !deleteId) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("input,button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setEditing(null);
        setDeleteId(null);
        setError("");
      }
      if (event.key === "Tab" && dialog) {
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select",
          ),
        ];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [Boolean(editing), Boolean(deleteId), busy]);
  const today = rounds.filter((r) => r.date === localDate());
  const summary = totals(today, settings.players);
  const players = editing?.players ?? settings.players,
    rules = editing?.rules ?? settings.rules;
  const validInput =
    points.every((v) => v.trim() !== "" && Number.isInteger(Number(v))) &&
    chips.every((v) => v.trim() !== "" && Number.isInteger(Number(v)));
  let preview: ReturnType<typeof calculate> | null = null;
  try {
    if (validInput)
      preview = calculate(points.map(Number), chips.map(Number), rules);
  } catch {
    /* Rules validated on save. */
  }
  const pointSum = points.reduce((s, v) => s + Number(v), 0),
    chipSum = chips.reduce((s, v) => s + Number(v), 0);
  async function perform(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotice(message);
    } catch (caught) {
      setError(
        shared.selected && caught instanceof Error
          ? caught.message
          : "保存に失敗しました。保存容量やブラウザの設定を確認して、もう一度お試しください。",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(round?: Round) {
    if (shared.readOnly) return;
    setEditRevision(shared.room?.revision ?? 0);
    setEditing(
      round ?? {
        id: "",
        date: localDate(),
        players: participants(
          settings.players,
          [...rounds].sort((a, b) => b.createdAt - a.createdAt)[0]?.players,
        ),
        points: [0, 0, 0, 0],
        chips: [0, 0, 0, 0],
        rules: settings.rules,
        createdAt: 0,
      },
    );
    setDate(round?.date ?? localDate());
    setPoints((round?.points ?? [0, 0, 0, 0]).map(String));
    setChips((round?.chips ?? [0, 0, 0, 0]).map(String));
    setError("");
  }
  function close() {
    if (!busy) {
      setEditing(null);
      setError("");
    }
  }
  async function submit() {
    if (shared.readOnly) return;
    if (!editing || !validInput || !date) {
      setError("日付と4人分の整数を入力してください。");
      return;
    }
    const participantError = validateParticipants(editing.players);
    if (participantError) {
      setError(participantError);
      return;
    }
    if (pointSum !== rules.startingPoints * 4) {
      setError(
        `点数の合計を${number(rules.startingPoints * 4)}点にしてください。供託が残っている場合は点数に加算してください。`,
      );
      return;
    }
    if (chipSum !== 0) {
      setError(
        "チップは受け取りを＋、支払いを−で入力し、合計を0枚にしてください。",
      );
      return;
    }
    const r: Round = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      date,
      points: points.map(Number),
      chips: chips.map(Number),
      createdAt: editing.createdAt || Date.now(),
    };
    await perform(async () => {
      if (shared.selected) {
        await shared.commit(
          {
            version: 1,
            settings,
            rounds: [...rounds.filter((x) => x.id !== r.id), r],
          },
          editRevision,
        );
      } else {
        await saveRound(r);
        setRounds((current) => [...current.filter((x) => x.id !== r.id), r]);
      }
      setEditing(null);
    }, "対局結果を保存しました。");
  }
  async function storeSettings() {
    if (shared.readOnly) return;
    const message = validateRules(draft.rules);
    if (message) {
      setError(message);
      return;
    }
    const names = draft.players.map((p) => p.name.trim());
    if (
      names.length < 4 ||
      names.some((n) => !n) ||
      new Set(names).size !== names.length
    ) {
      setError("4人以上の名前を重複せずに登録してください。");
      return;
    }
    const updated = {
      ...draft,
      players: draft.players.map((p, i) => ({ ...p, name: names[i] })),
    };
    await perform(async () => {
      if (shared.selected) {
        await shared.commit(
          { version: 1, settings: updated, rounds },
          draftRevision,
        );
        setDraftRevision(draftRevision + 1);
      } else {
        await saveSettings(updated);
        setSettings(updated);
      }
      setDraft(updated);
    }, "プレイヤーとルールを保存しました。");
  }
  function download() {
    const blob = new Blob([exportCsv(rounds)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `雀録-${localDate()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("today");
          }}
        >
          <span className="tile-logo">雀</span>
          <span>
            雀録<small>MAHJONG SCORE</small>
          </span>
        </a>
        <span className="local-tag">
          <i />
          {shared.selected ? "共有ルーム" : "端末に保存"}
        </span>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">YOUR TABLE, YOUR RECORD.</p>
            <h1>
              {tab === "today"
                ? "今日の対局"
                : tab === "history"
                  ? "対局の記録"
                  : "プレイヤー・ルール"}
            </h1>
            <p className="muted">
              {tab === "today"
                ? `${localDate().replaceAll("-", " / ")} · 一局一局を、大切に。`
                : tab === "history"
                  ? "積み重ねた勝負を、いつでも振り返る。"
                  : "いつもの4人で、いつものルールを。"}
            </p>
          </div>
          <span className="decoration" aria-hidden="true">
            發
          </span>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        <RoomPanel
          shared={shared}
          snapshot={{ version: 1, settings, rounds }}
          disabled={busy || !ready}
        />
        {!ready || (shared.selected && !shared.room) ? (
          <div className="empty">
            {shared.selected ? "共有ルームに接続しています。接続できない場合は上の案内をご確認ください。" : error ? "保存領域を利用できません。" : "記録を読み込んでいます…"}
          </div>
        ) : (
          <>
            {tab === "today" && (
              <>
                <div className="stat-strip">
                  <div>
                    <span>本日の半荘</span>
                    <strong>
                      {today.length}
                      <small>回</small>
                    </strong>
                  </div>
                  <div>
                    <span>現在のトップ</span>
                    <strong className="leader">
                      {summary[0]?.games
                        ? `${summary[0].name}${summary.filter((row) => row.rank === 1).length > 1 ? " ほか" + (summary.filter((row) => row.rank === 1).length - 1) + "人" : ""}`
                        : "—"}
                    </strong>
                  </div>
                </div>
                <div className="section-heading">
                  <h2>本日の成績</h2>
                  <span className="eyebrow">DAILY SCORE</span>
                </div>
                <div className="score-list">
                  {summary.map((row) => (
                    <article
                      className={`score-card ${row.rank === 1 ? "first" : ""}`}
                      key={row.id}
                    >
                      <span className="rank">
                        {row.rank || "—"}
                        <small>位</small>
                      </span>
                      <div className="player">
                        <h3>{row.name}</h3>
                        <p>
                          トップ率 {row.topRate.toFixed(1)}%{" "}
                          <span>· {row.games}回</span>
                        </p>
                      </div>
                      <div className="score">
                        <strong className={row.score < 0 ? "negative" : ""}>
                          {signed(row.score)}
                        </strong>
                        <small>
                          チップ {signed(row.chipPoints)} pt ·{" "}
                          {signed(row.chipCount)}枚
                        </small>
                        {row.chipAmount !== 0 && (
                          <small>
                            旧記録 {signed(row.chipAmount)}円（別集計）
                          </small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {today.length === 0 && (
                  <p className="hint">
                    まだ対局の記録がありません。最初の半荘を記録しましょう。
                  </p>
                )}
                <button
                  className="primary full add-round"
                  disabled={shared.readOnly || busy}
                  onClick={() => open()}
                >
                  ＋ 半荘の結果を入力
                </button>
                <div className="rule-summary">
                  <span>現在のルール</span>
                  <p>
                    {number(settings.rules.startingPoints)}点持ち /{" "}
                    {number(settings.rules.returnPoints)}点返し
                  </p>
                  <small>
                    ウマ {settings.rules.uma.join(" / ")} · オカ{" "}
                    {number(
                      ((settings.rules.returnPoints -
                        settings.rules.startingPoints) *
                        4) /
                        1000,
                    )}
                  </small>
                  <button
                    onClick={() => {
                      setDraft(settings);
                      setDraftRevision(shared.room?.revision??0);
                      setTab("settings");
                      setError("");
                    }}
                  >
                    設定を変更 →
                  </button>
                </div>
              </>
            )}
            {tab === "history" && (
              <>
                <div className="history-tools">
                  <label>
                    日付で絞り込み
                    <input
                      type="date"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </label>
                  <button className="secondary" onClick={() => setFilter("")}>
                    全期間
                  </button>
                  <button
                    className="secondary"
                    onClick={download}
                    disabled={!rounds.length}
                  >
                    CSV出力
                  </button>
                </div>
                <p className="hint">
                  CSVは全期間・全プレイヤーの結果を出力します。
                </p>
                {rounds
                  .filter((r) => !filter || r.date === filter)
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
                  )
                  .map((r) => (
                    <article className="history-card" key={r.id}>
                      <div className="section-heading">
                        <h2>{r.date.replaceAll("-", " / ")}</h2>
                        <span className="muted">
                          {new Date(r.createdAt).toLocaleTimeString("ja-JP", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {calculate(r.points, r.chips, r.rules).map((s, i) => (
                        <div className="history-row" key={r.players[i].id}>
                          <span>{s.rank}位</span>
                          <strong>
                            {r.players[i].name}
                            <small className="history-chips">
                              チップ{" "}
                              {r.rules.chipPoints !== undefined
                                ? `${signed(s.chipPoints)} pt`
                                : `旧記録 ${signed(s.chipAmount)}円`}
                            </small>
                          </strong>
                          <span>{number(r.points[i])}点</span>
                          <b className={s.score < 0 ? "negative" : ""}>
                            {signed(s.score)}
                          </b>
                        </div>
                      ))}
                      <div className="history-actions">
                        <button
                          disabled={shared.readOnly || busy}
                          className="secondary"
                          onClick={() => open(r)}
                        >
                          修正
                        </button>
                        <button
                          className="danger"
                          disabled={shared.readOnly || busy}
                          onClick={() => {
                            setDeleteRevision(shared.room?.revision ?? 0);
                            setDeleteId(r.id);
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </article>
                  ))}
                {!rounds.some((r) => !filter || r.date === filter) && (
                  <div className="empty">
                    <span>▤</span>
                    <h2>記録がありません</h2>
                    <p>保存した半荘がここに表示されます。</p>
                  </div>
                )}
              </>
            )}
            {tab === "settings" && (
              <fieldset
                className="settings-fields"
                disabled={shared.readOnly || busy}
              >
                <section className="panel">
                  <h2>プレイヤー登録</h2>
                  <p className="hint">
                    同点を席順で決める場合、東 → 南 → 西 →
                    北を優先します。5人以上も登録でき、半荘ごとに参加する4人を選べます。休みの人の成績はそのまま残ります。名前の変更は同じプレイヤーの表示名変更です。
                  </p>
                  <div className="form-grid">
                    {draft.players.map((p, i) => (
                      <div key={p.id}>
                        <label>
                          プレイヤー{i + 1}
                          <input
                            maxLength={20}
                            value={p.name}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                players: draft.players.map((v, j) =>
                                  j === i ? { ...v, name: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="danger"
                          disabled={draft.players.length <= 4}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              players: draft.players.filter(
                                (player) => player.id !== p.id,
                              ),
                            })
                          }
                        >
                          登録から外す
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary full"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        players: [
                          ...draft.players,
                          { id: crypto.randomUUID(), name: "" },
                        ],
                      })
                    }
                  >
                    ＋ プレイヤーを追加
                  </button>
                  <p className="hint">
                    最低4人を登録してください。登録から外しても過去の対局は削除されません。別の人を登録するときは名前の上書きではなく追加してください。
                  </p>
                </section>
                <section className="panel">
                  <h2>点数計算</h2>
                  <div className="form-grid">
                    {(
                      [
                        ["startingPoints", "持ち点"],
                        ["returnPoints", "返し点"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={draft.rules[key]}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rules: {
                                ...draft.rules,
                                [key]: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className="hint">
                    オカは（返し点 − 持ち点）× 4 ÷ 1,000
                    を自動計算し、トップに加算します。
                  </p>
                  <h3>ウマ（千点単位）</h3>
                  <div className="uma-grid">
                    {draft.rules.uma.map((v, i) => (
                      <label key={i}>
                        {i + 1}位
                        <input
                          type="number"
                          value={v}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rules: {
                                ...draft.rules,
                                uma: draft.rules.uma.map((x, j) =>
                                  j === i ? Number(e.target.value) : x,
                                ),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    同点時の順位
                    <select
                      value={draft.rules.tie}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            tie: e.target.value as "split" | "seat",
                          },
                        })
                      }
                    >
                      <option value="split">
                        同順位・ウマとオカを均等分配
                      </option>
                      <option value="seat">
                        席順優先（東 → 南 → 西 → 北）
                      </option>
                    </select>
                  </label>
                  <p className="hint">
                    均等分配ではトップ率も人数で分配します。累計順位は同スコアを同順位で表示します。
                  </p>
                </section>
                <section className="panel">
                  <h2>チップ</h2>
                  <label>
                    1枚あたりのポイント
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.rules.chipPoints}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            chipPoints: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <p className="hint">
                    チップはポイントで別集計します。順位は麻雀スコアのみで決定します。ルール変更は今後の対局に適用されます。
                  </p>
                </section>
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={storeSettings}
                >
                  設定を保存
                </button>
                <div className="privacy">
                  <h3>あなたの記録は、この端末に。</h3>
                  <p>
                    データはブラウザ内のIndexedDBに保存されます。ブラウザのデータ削除で失われるため、定期的にCSVを出力してください。共有ルームでは招待した人と成績を共有できます。CSV復元は未対応です。
                  </p>
                  <p>
                    iPhoneはSafariの共有メニュー
                    →「ホーム画面に追加」。Androidはブラウザメニュー
                    →「アプリをインストール」で追加できます。
                  </p>
                </div>
              </fieldset>
            )}
          </>
        )}
      </main>
      <nav aria-label="メインメニュー">
        {(
          [
            ["today", "◈", "今日"],
            ["history", "▤", "履歴"],
            ["settings", "⚙", "設定"],
          ] as const
        ).map(([key, icon, label]) => (
          <button
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
              setNotice("");
              if (key === "settings") {
                setDraft(settings);
                setDraftRevision(shared.room?.revision ?? 0);
              }
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      {editing && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">ROUND RESULT</p>
                <h2 id="entry-title">
                  {editing.id ? "対局結果を修正" : "半荘の結果を入力"}
                </h2>
              </div>
              <button
                className="close"
                aria-label="閉じる"
                onClick={close}
                disabled={busy}
              >
                ×
              </button>
            </div>
            <label>
              対局日
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <p className="hint">
              点数は素点、チップは増減を入力。箱下は「−」で入力できます。
            </p>
            {!editing.id && (
              <section className="participant-picker">
                <h3>今回の参加者（4人）</h3>
                <div className="form-grid">
                  {players.map((p, i) => (
                    <label key={i}>
                      {seats[i]}家の参加者
                      <select
                        value={p.id}
                        onChange={(e) => {
                          const selected = settings.players.find(
                            (player) => player.id === e.target.value,
                          );
                          if (selected)
                            setEditing({
                              ...editing,
                              players: editing.players.map((player, j) =>
                                j === i ? selected : player,
                              ),
                            });
                        }}
                      >
                        {settings.players.map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={players.some(
                              (other, j) => j !== i && other.id === player.id,
                            )}
                          >
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="hint">
                  休み:{" "}
                  {settings.players
                    .filter(
                      (p) => !players.some((player) => player.id === p.id),
                    )
                    .map((p) => p.name)
                    .join("、") || "なし"}
                  。同点の席順優先はこの席順で判定します。
                </p>
              </section>
            )}
            <div className="entry-heading">
              <span>プレイヤー</span>
              <span>終了点数</span>
              <span>チップ枚数</span>
            </div>
            {players.map((p, i) => (
              <div className="entry-row" key={p.id}>
                <div>
                  <span className="seat">{seats[i]}</span>
                  <strong>{p.name}</strong>
                  <small>
                    {preview
                      ? `${preview[i].rank}位 / ${signed(preview[i].score)}`
                      : "—"}
                  </small>
                </div>
                <input
                  aria-label={`${p.name}の点数`}
                  type="number"
                  step="100"
                  value={points[i]}
                  onChange={(e) =>
                    setPoints(
                      points.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
                <input
                  aria-label={`${p.name}のチップ枚数`}
                  type="number"
                  step="1"
                  value={chips[i]}
                  onChange={(e) =>
                    setChips(
                      chips.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </div>
            ))}
            <div
              className={`total-bar ${pointSum === rules.startingPoints * 4 && validInput ? "balanced" : ""}`}
            >
              <span>点数合計</span>
              <strong>
                {number(pointSum)}
                <small> / {number(rules.startingPoints * 4)}点</small>
              </strong>
            </div>
            <p className="hint">
              チップ合計 {number(chipSum)}枚 / 0枚 · オカ{" "}
              {number(((rules.returnPoints - rules.startingPoints) * 4) / 1000)}{" "}
              · ウマ {rules.uma.join(" / ")}
            </p>
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy} onClick={submit}>
              {busy ? "保存中…" : "結果を保存"}
            </button>
            <button
              className="text-button full"
              onClick={close}
              disabled={busy}
            >
              キャンセル
            </button>
          </section>
        </div>
      )}
      {deleteId && (
        <div className="overlay">
          <section
            className="modal small"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">この対局を削除しますか？</h2>
            <p className="hint">
              累計成績も再計算されます。この操作は取り消せません。
            </p>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <button
              className="primary full"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  if (shared.selected) {
                    await shared.commit(
                      {
                        version: 1,
                        settings,
                        rounds: rounds.filter((r) => r.id !== deleteId),
                      },
                      deleteRevision,
                    );
                  } else {
                    await removeRound(deleteId);
                    setRounds((current) =>
                      current.filter((r) => r.id !== deleteId),
                    );
                  }
                  setDeleteId(null);
                }, "対局を削除しました。")
              }
            >
              削除する
            </button>
            <button
              className="text-button full"
              disabled={busy}
              onClick={() => setDeleteId(null)}
            >
              キャンセル
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
