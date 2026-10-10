import { useState } from "react";
import { inviteUrl } from "./client";
import type { useRoom } from "./useRoom";
import type { Snapshot } from "./schema";
export default function RoomPanel({
  shared,
  snapshot,
  disabled,
}: {
  shared: ReturnType<typeof useRoom>;
  snapshot: Snapshot;
  disabled: boolean;
}) {
  const [confirm, setConfirm] = useState(false),
    [copied, setCopied] = useState(false);
  const locked = disabled || shared.loading;
  return (
    <section className="panel room-panel" aria-label="対局ルーム">
      <div className="section-heading">
        <h2>{shared.selected ? "共有対局ルーム" : "みんなで成績を共有"}</h2>
        <span className="muted">
          {shared.selected
            ? shared.room?.owner
              ? "代表者"
              : "閲覧専用"
            : "端末内モード"}
        </span>
      </div>
      {shared.error && (
        <div role="alert" className="alert">
          {shared.error}
        </div>
      )}
      {!shared.selected ? (
        <>
          {shared.configured ? (
            <>
              <p className="hint">
                ルームを作ると、この端末の記録をコピーして共有できます。招待された人は閲覧のみ。端末内の元データは残ります。
              </p>
              {!confirm ? (
                <button
                  className="secondary full"
                  disabled={locked}
                  onClick={() => setConfirm(true)}
                >
                  共有ルームを作成
                </button>
              ) : (
                <>
                  <p className="hint">
                    現在の設定と全{snapshot.rounds.length}
                    半荘の記録を共有ルームにコピーします。招待リンクを知っている人が閲覧できます。
                  </p>
                  <button
                    className="primary full"
                    disabled={locked}
                    onClick={() => {
                      void shared
                        .create(snapshot)
                        .then(() => setConfirm(false))
                        .catch(() => {});
                    }}
                  >
                    現在の記録をコピーして作成
                  </button>
                  <button
                    className="text-button full"
                    disabled={locked}
                    onClick={() => setConfirm(false)}
                  >
                    キャンセル
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="hint">
              端末内で利用できます。共有機能は管理者によるSupabase接続設定後に使えるようになります。
            </p>
          )}
        </>
      ) : (
        <>
          <p className="hint">
            {shared.connected ? "接続中" : "未接続・変更できません"} ·
            約15秒ごとに自動更新
            {shared.updatedAt
              ? ` · 最終取得 ${new Date(shared.updatedAt).toLocaleTimeString("ja-JP")}`
              : ""}
          </p>
          {shared.room?.owner && (
            <>
              <label>
                閲覧用の招待リンク
                <input
                  aria-label="閲覧用の招待リンク"
                  readOnly
                  value={inviteUrl(shared.room)}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="secondary full"
                disabled={locked}
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(inviteUrl(shared.room!))
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "コピーしました" : "招待リンクをコピー"}
              </button>
              <button
                className="text-button full"
                disabled={locked}
                onClick={() => {
                  if (
                    window.confirm(
                      "古い招待リンクを無効にして新しいリンクを発行しますか？",
                    )
                  ) {
                    setCopied(false);
                    void shared.renew();
                  }
                }}
              >
                招待リンクを再発行
              </button>
              <p className="hint">
                代表者の編集権限は作成時のブラウザに保存されます。ブラウザデータを消すと編集権限を失います。定期的にCSVを保存してください。
              </p>
            </>
          )}
          <div className="history-actions">
            <button
              className="secondary"
              disabled={locked}
              onClick={() => void shared.refresh()}
            >
              今すぐ更新
            </button>
            <button
              className="secondary"
              disabled={locked}
              onClick={() => {
                setConfirm(false);
                setCopied(false);
                shared.leave();
              }}
            >
              端末の記録に戻る
            </button>
          </div>
        </>
      )}
    </section>
  );
}
