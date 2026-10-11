# 旧共有ルームから端末内保存への移行

現在のアプリはSupabaseを使用しません。既存の端末内記録はそのまま利用できますが、旧共有ルームの記録は別保存なので自動では移りません。

1. SupabaseのSQL Editorで次を実行します（読み取りのみ）。

```sql
select id, updated_at, data::text as backup_json
from public.score_rooms
order by updated_at desc;
```

2. 必要なルームの `backup_json` の値だけをコピーし、テキストエディタで `mahjong-backup.json` としてUTF-8保存します。行全体やCSVではなく、`{"version":1,...}` というJSON本文です。複数ルームがある場合はそれぞれ保存してください。
3. 新アプリの「設定」→「JSONバックアップを読み込む」でファイルを選びます。設定と同じIDの記録は上書きされ、それ以外の記録は残ります。事前に端末内記録のJSONバックアップを保存してください。
4. 履歴・成績が移ったことを確認し、JSONファイルも保管してください。

GitHub ActionsのVariablesにある `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` は削除できます。現行ビルドでは使いません。

新アプリが公開されてもSupabase上の旧APIは残り、古いアプリからアクセスされ得ます。すべての必要な記録を取得した後、Supabase管理画面でプロジェクトを停止・削除することで旧共有機能も停止できます。プロジェクト削除はデータを失う操作なので、バックアップと移行確認後に行ってください。この変更でプロジェクトの停止・削除は自動実行しません。
