import { useState } from "react";
import { parseSnapshot, type Snapshot } from "./backup/schema";
import { importBackup } from "./storage/db";
export default function BackupPanel({
  snapshot,
  disabled,
  onImported,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  onImported: (data: Snapshot) => void;
}) {
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  return (
    <section className="panel" aria-label="バックアップ">
      <h2>バックアップ・復元</h2>
      <p className="hint">
        記録はこのブラウザに保存されます。JSONを保存すると機種変更時に復元できます。旧共有ルームから取得したJSONも読み込めます。
      </p>
      <button
        className="secondary full"
        disabled={disabled || working}
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "mahjong-backup.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        JSONバックアップを保存
      </button>
      <label>
        JSONバックアップを読み込む
        <input
          type="file"
          accept=".json,application/json"
          disabled={disabled || working}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setMessage("");
            setWorking(true);
            try {
              if (file.size > 1000000)
                throw new Error("ファイルが大きすぎます（上限1MB）。");
              const data = parseSnapshot(JSON.parse(await file.text()));
              if (
                !window.confirm(
                  `${data.rounds.length}半荘を取り込みます。設定と同じIDの記録は上書きし、その他の記録は残します。続けますか？`,
                )
              )
                return;
              const merged = await importBackup(data);
              onImported({
                version: 1,
                settings: merged.settings!,
                rounds: merged.rounds,
              });
              setMessage("記録を取り込みました。");
            } catch {
              setMessage(
                "読み込めませんでした。正しいJSONバックアップと保存領域を確認してください。",
              );
            } finally {
              setWorking(false);
            }
          }}
        />
      </label>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
