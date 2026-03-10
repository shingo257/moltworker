# サンドボックス環境 初回運用チェックリスト

Cloudflare を課金しているが、まだ一度もサンドボックスでの運用が成功していない方向けの手順です。**まずは「ゲートウェイが起動して Control UI が開ける」ところまで**を目標にします。

---

## 前提

- **Workers 有料プラン**（月 $5）に加入済み
- **Node.js 22** がローカルにインストール済み（`node -v` で確認）
- このリポジトリをクローン済みで `npm install` 済み
- **Docker Desktop（または Docker CLI + デーモン）がインストールされ、起動している**
  - コンテナイメージのビルドにローカル Docker が必須です。未導入の場合は [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) を入れ、トレイで「Running」になってから `npm run deploy` してください。
  - エラー `The Docker CLI could not be launched` は「Docker が入っていない／起動していない」が原因です。

---

## Step 1: 必須シークレットの設定（本番デプロイ用）

本番の Worker には次のシークレットが**最低限**必要です。

```bash
# 1. Anthropic API キー（Claude 用）
npx wrangler secret put ANTHROPIC_API_KEY
# プロンプトで sk-ant-... を入力

# 2. ゲートウェイトークン（Control UI アクセス用。自分で決めた文字列でOK）
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
# 例: 英数字で 32 文字以上（openssl rand -hex 32 で生成しても可）
```

**初回だけ**、認証をスキップして「とにかく起動する」ために、次も設定します。

```bash
# 3. 開発モード（Cloudflare Access とデバイスペアリングをスキップ）
npx wrangler secret put DEV_MODE
# プロンプトで true と入力

# 4. デバッグルートを有効化（失敗時のログ確認用）
npx wrangler secret put DEBUG_ROUTES
# プロンプトで true と入力
```

- `DEV_MODE=true` にすると **Cloudflare Access の設定がなくても** `/_admin/` や Control UI にアクセスできます。
- `DEBUG_ROUTES=true` にすると **`/debug/processes`** などでコンテナ内のプロセスや stderr を確認できます。
- 本番運用時には `DEV_MODE` を外し、Cloudflare Access とデバイスペアリングを有効にします。

---

## Step 2: wrangler.jsonc の確認（オプション）

サブリクエスト制限で失敗しやすい環境では、**Sandbox を WebSocket トランスポートで使う**設定が有効な場合があります。未コミットの変更に以下があれば、そのまま使って問題ありません。

```jsonc
"vars": {
  "SANDBOX_TRANSPORT": "websocket",
},
```

含まれていなければ、`wrangler.jsonc` の `observability` の直後に上記 `vars` を追加してからデプロイしてみてください。

---

## Step 3: ビルドとデプロイ

```bash
npm run build
npm run deploy
```

- 初回は **コンテナイメージのビルド・プッシュ** で数分かかることがあります。
- エラーが出たら、次の「失敗時の確認」に進みます。

---

## Step 4: 起動確認（初回は 1〜2 分かかることがある）

デプロイ後、Worker の URL が表示されます（例: `https://moltbot-sandbox.xxxx.workers.dev`）。

1. **ヘルスチェック**
   ```
   https://あなたのWorkerURL/sandbox-health
   ```
   → `{"status":"ok", ...}` が返れば Worker 自体は動いています。

2. **ゲートウェイ状態（重要）**
   ```
   https://あなたのWorkerURL/api/status
   ```
   - `ok: true`, `status: "running"` なら **ゲートウェイ起動成功**です。
   - `ok: false` のときは `gatewayProcess.status` / `gatewayProcess.exitCode` / `lastStderrPreview` を確認します。

3. **Control UI を開く**
   ```
   https://あなたのWorkerURL/?token=ここにMOLTBOT_GATEWAY_TOKENで設定した値
   ```
   - `DEV_MODE=true` にしているので、**デバイスペアリングなし**でチャット画面まで開ける想定です。
   - 初回アクセスでコンテナが起動するため、**1〜2 分** かかることがあります。ローディング画面のまま少し待ってください。

---

## 失敗時の確認（ここで原因を切り分ける）

### A. `/api/status` を開く

ブラウザまたは curl で:

```
https://あなたのWorkerURL/api/status
```

JSON の例:

- `gatewayProcess`: ゲートウェイプロセスの有無・状態・終了コード
- `lastStderrPreview`: 直近で失敗したゲートウェイの stderr の一部（設定ミスや exit 126 の手がかり）

### B. デバッグルートで詳細ログ（DEBUG_ROUTES=true の場合）

```
https://あなたのWorkerURL/debug/processes?logs=true&failed=1
```

- ゲートウェイ関連で **failed / completed（終了コード非0）** のプロセス一覧と、その **stdout/stderr** が確認できます。
- `lastFailedStderrPreview` に sanitize された stderr が出ていれば、その内容を読むと原因に近づけます。

### C. ターミナルでリアルタイムログ

```bash
npx wrangler tail
```

別タブで Worker の URL にアクセスし、tail に出る `[WS] close` / `[WS] error` や `[PROXY]` の行を確認します。

### D. よくある失敗パターン

| 症状 | 想定原因 | 対処 |
|------|----------|------|
| **exit code 126** | `start-openclaw.sh` が CRLF で保存されている、または実行権限がない | `.gitattributes` に `*.sh text eol=lf` があることを確認。Windows では `git config --global core.autocrlf input` を推奨。リポジトリを再度 clone し直してから `npm run deploy`。 |
| **Configuration error / 503** | 必須シークレット不足 | `ANTHROPIC_API_KEY` と `MOLTBOT_GATEWAY_TOKEN` を設定。本番で Access を使うなら `CF_ACCESS_TEAM_DOMAIN` と `CF_ACCESS_AUD` も必要。 |
| **Health OK だが Control UI が反応しない** | ゲートウェイが落ちているか WebSocket で失敗 | `/api/status` の `lastStderrPreview` と `/debug/processes?logs=true&failed=1` で stderr を確認。`wrangler tail` で `[WS] close` の code/reason を確認。 |
| **コンテナが起動しない / タイムアウト** | ネットワーク・課金・リージョン | Workers 有料プラン・Sandbox が有効かダッシュボードで確認。`SANDBOX_TRANSPORT=websocket` を試す。 |

---

## まとめ（最短で試す流れ）

1. `ANTHROPIC_API_KEY` と `MOLTBOT_GATEWAY_TOKEN` を `npx wrangler secret put` で設定する。
2. 初回だけ `DEV_MODE` と `DEBUG_ROUTES` を `true` で設定する。
3. `npm run build` → `npm run deploy` でデプロイする。
4. `/api/status` で `ok: true` になるまで待つ（必要なら `/debug/processes?logs=true&failed=1` で失敗理由を確認）。
5. `https://あなたのWorkerURL/?token=あなたのトークン` で Control UI を開く。

ここまで成功したら「サンドボックス環境での運用 1 回目」は達成です。そのあと、Cloudflare Access の設定やデバイスペアリング、R2 の永続化などは README の手順に沿って進められます。
