# Error English Video Generator

エンジニア向けの英語エラー解説動画を自動生成・投稿するプロジェクトです。

## 🚀 クイックスタート (コマンド一覧)

このプロジェクトには、動画の生成から投稿までを効率的に行うためのコマンドが用意されています。

### 1. 自動投稿 (推奨)
在庫から1つ取り出し、**動画作成 → YouTube投稿 → 在庫削除** までを一気に行います。
```bash
npm run process-next
```

### 2. 動画作成のみ (投稿なし)
在庫から1つ取り出して **動画作成のみ** 行います。
作成された動画は `out/` フォルダに保存されます。

**デフォルト (在庫消費あり):**
作成完了後、そのアイテムは在庫から削除され、履歴 (`history.json`) に移動します。
```bash
npm run create-next
```

**テストモード (在庫消費なし):**
`--test` オプションを付けると、在庫を削除せずに動画を作成できます。何度でも同じデータで試せます。
```bash
npm run create-next -- --test
```
※ `npm run` で引数を渡す際は `--` が必要です。

### 3. 在庫補充
AIを使って新しいエラーデータを生成し、`data/errors.json` に追加します。
```bash
npm run replenish
```

### 4. 手動アップロード
すでに作成済みの動画ファイルをYouTubeに投稿します。
```bash
npm run upload-file out/video.mp4
```

### 5. プレビュー起動
Remotionのプレビュー画面をブラウザで開きます。UI上で確認・調整したい場合に使います。
```bash
npm run start
```

---

## 📁 ディレクトリ構成
- `src/`: 動画のソースコード (Remotion)
- `scripts/`: 自動化スクリプト群
- `data/`: データファイル
    - `errors.json`: 動画生成待ちのネタ在庫
    - `history.json`: 生成済みのネタ履歴
- `out/`: 生成された動画の出力先

## ⚙️ セットアップ
`.env` ファイルに以下の設定が必要です。
- `AIVIS_API_KEY`: AI生成用
- `YOUTUBE_CLIENT_ID`: YouTube投稿用
- `YOUTUBE_CLIENT_SECRET`: YouTube投稿用
- `YOUTUBE_REFRESH_TOKEN`: YouTube投稿用 (永続トークン推奨)
