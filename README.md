# OpenClaw を Cloudflare Workers で動かす（moltworker）

[OpenClaw](https://github.com/openclaw/openclaw)（旧 Moltbot / Clawdbot）という**個人用 AI アシスタント**を [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) 上のコンテナで動作させる Cloudflare Worker です。自前サーバーなしで、Cloudflare 上で常時稼働させられます。

![moltworker architecture](./assets/logo.png)

> **実験的:** Cloudflare Sandbox 上で OpenClaw が動作することを示す PoC です。公式サポートはなく、予告なく動作が変わる可能性があります。自己責任で利用してください。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/moltworker)

## このプロジェクトでできること

- **OpenClaw** を Cloudflare のコンテナ（Sandbox）内で起動する
- ブラウザ用 **Control UI**（チャット画面）を Worker 経由で提供する
- **管理画面**（`/_admin/`）でデバイス承認・R2 バックアップ・ゲートウェイ再起動を行う
- **Telegram / Discord / Slack** と連携できる（任意）
- **R2** を有効にすると、再起動後もペアリング・会話履歴を保持できる

## 必要なもの

- [Workers 有料プラン](https://www.cloudflare.com/plans/developer-platform/)（月 $5）— Sandbox コンテナ利用に必須
- [Anthropic API キー](https://console.anthropic.com/) — Claude 利用用（OpenClaw では Anthropic Pro/Max + Opus 4.6 を推奨。または [AI Gateway の Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) を利用可）
- ローカル開発時は **Node.js 22 以上**（コンテナ内は Node 22 を使用）

以下の Cloudflare 機能は無料枠で利用可能です：
- Cloudflare Access（認証）
- Browser Rendering（ブラウザ操作）
- AI Gateway（任意・API ルーティング／分析）
- R2 Storage（任意・永続化）

## コンテナの概算コスト

`standard-1` インスタンス（1/2 vCPU、4 GiB メモリ、8 GB ディスク）を 24 時間稼働させた場合の [Cloudflare Containers 料金](https://developers.cloudflare.com/containers/pricing/)の目安です。

| リソース | プロビジョン | 月間使用量 | 無料枠 | 超過分 | 概算 |
|----------|--------------|------------|--------|--------|------|
| メモリ | 4 GiB | 2,920 GiB-hrs | 25 GiB-hrs | 2,895 GiB-hrs | 約 $26/月 |
| CPU（約 10% 使用時） | 1/2 vCPU | 約 2,190 vCPU-min | 375 vCPU-min | 約 1,815 vCPU-min | 約 $2/月 |
| ディスク | 8 GB | 5,840 GB-hrs | 200 GB-hrs | 5,640 GB-hrs | 約 $1.50/月 |
| Workers 有料プラン | — | — | — | — | $5/月 |
| **合計** | | | | | **約 $34.50/月** |

- CPU は**実際の使用量**のみ課金。メモリ・ディスクはプロビジョン分が稼働中ずっと課金されます。
- コスト削減: `SANDBOX_SLEEP_AFTER` で無稼働後にスリープ（例: `10m`）。1 日 4 時間稼働ならコンピュートは約 $5–6/月程度になります。
- 他のインスタンス（例: `lite` 256 MiB、`standard-4` 12 GiB）は [料金表](https://developers.cloudflare.com/containers/pricing/)を参照してください。

## OpenClaw とは

[OpenClaw](https://github.com/openclaw/openclaw)（[openclaw.ai](https://openclaw.ai)）は、**「Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞」** を掲げる、ゲートウェイ型の個人用 AI アシスタントです。MIT ライセンスのオープンソースで、自分でホストするゲートウェイがチャットアプリと AI エージェントの橋渡しをします。

OpenClaw 本体は **WhatsApp、Telegram、Discord、Slack、Google Chat、Signal、iMessage、BlueBubbles、Microsoft Teams、Matrix、Zalo、WebChat** など多数のチャネルに対応しています。**moltworker** ではコンテナ内で **Telegram / Discord / Slack** の連携を設定する構成をドキュメントしています。

- **Control UI** — ゲートウェイ上の Web チャット（ブラウザダッシュボード）
- **マルチチャネル** — 1 つのゲートウェイで複数チャネルを同時に利用
- **デバイスペアリング** — 管理画面での明示的な承認が必要（デフォルトは DM ポリシー `pairing`）
- **会話の永続化** — 履歴・コンテキストの保持
- **エージェント・スキル** — ワークスペースやスキルで拡張可能。ClawHub でスキルを検索・追加可能

このリポジトリ（moltworker）は、OpenClaw を [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) コンテナ用にパッケージし、自前サーバーなしで常時稼働させるための Worker です。R2 を設定すると再起動後もデータを保持できます。

## アーキテクチャ

![moltworker architecture](./assets/architecture.png)

## クイックスタート

_Cloudflare Sandbox は [Workers 有料プラン](https://dash.cloudflare.com/?to=/:account/workers/plans) で利用できます。_

```bash
# 依存関係のインストール
npm install

# Anthropic API キーを設定（直接利用する場合）
npx wrangler secret put ANTHROPIC_API_KEY

# または Cloudflare AI Gateway を使う場合（後述の「Cloudflare AI Gateway」を参照）
# npx wrangler secret put CLOUDFLARE_AI_GATEWAY_API_KEY
# npx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
# npx wrangler secret put CF_AI_GATEWAY_GATEWAY_ID

# ゲートウェイトークンを生成して設定（リモートアクセスに必須）
# このトークンは Control UI アクセス時に必要なので控えておく
export MOLTBOT_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "Your gateway token: $MOLTBOT_GATEWAY_TOKEN"
echo "$MOLTBOT_GATEWAY_TOKEN" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN

# デプロイ
npm run deploy
```

デプロイ後、トークン付きで Control UI を開きます。

```
https://your-worker.workers.dev/?token=YOUR_GATEWAY_TOKEN
```

`your-worker` を実際の Worker サブドメインに、`YOUR_GATEWAY_TOKEN` を上記で生成したトークンに置き換えてください。

**注意:** 初回リクエストはコンテナ起動のため 1〜2 分かかることがあります。

> **重要:** 以下の 2 つを完了するまで Control UI は利用できません。
> 1. [管理 UI の設定](#管理-ui-の設定) — Cloudflare Access で `/_admin/` を保護する
> 2. [デバイスペアリング](#デバイスペアリング) — `/_admin/` でデバイスを承認する

[永続ストレージ（R2）](#永続ストレージ-r2) を有効にすると、再起動後もペアリング・会話履歴が保持されます（任意だが推奨）。

## 管理 UI の設定

`/_admin/` の管理画面を使うには、次が必要です。
1. Worker で Cloudflare Access を有効にする
2. Access 用のシークレットを設定し、Worker が JWT を検証できるようにする

### 1. workers.dev で Cloudflare Access を有効にする

1. [Workers & Pages ダッシュボード](https://dash.cloudflare.com/?to=/:account/workers-and-pages) を開く
2. 対象 Worker（例: `moltbot-sandbox`）を選択
3. **Settings** → **Domains & Routes** の `workers.dev` 行の `...` をクリック
4. **Enable Cloudflare Access** をクリック
5. 表示された値（後で AUD タグが必要）を控える。「Manage Cloudflare Access」が 404 になる場合は無視してよい
6. **Zero Trust** → **Access** → **Applications** で対象アプリを開き、許可するメールや IdP（Google / GitHub など）を設定
7. そのアプリの **Application Audience (AUD)** を控える（次のステップで `CF_ACCESS_AUD` に設定）

### 2. Access 用シークレットの設定

```bash
# Cloudflare Access のチームドメイン（例: myteam.cloudflareaccess.com）
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN

# 上記で控えた Application Audience (AUD)
npx wrangler secret put CF_ACCESS_AUD
```

チームドメインは [Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) の **Settings** > **Custom Pages** で確認できます（`.cloudflareaccess.com` の前のサブドメイン）。

### 3. 再デプロイ

```bash
npm run deploy
```

これで `/_admin/` にアクセスすると、Cloudflare Access で認証後に管理画面が開きます。

### 手動で Access アプリを作る場合

1. [Cloudflare Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) → **Access** > **Applications**
2. **Self-hosted** アプリを新規作成
3. アプリのドメインを Worker の URL（例: `moltbot-sandbox.xxx.workers.dev`）に設定
4. 保護するパス: `/_admin/*`, `/api/*`, `/debug/*`
5. IdP（メール OTP、Google、GitHub など）を設定
6. **AUD** を控え、上記のシークレットを設定

### ローカル開発

`.dev.vars` を作成します。

```bash
DEV_MODE=true               # Cloudflare Access をスキップし、デバイスペアリングもスキップ
DEBUG_ROUTES=true           # /debug/* を有効にする（任意）
```

## 認証

OpenClaw は標準で**デバイスペアリング**を使います。新しいデバイス（ブラウザ・CLI など）は、`/_admin/` で承認されるまで接続が保留されます。

### デバイスペアリング

1. デバイスがゲートウェイに接続する
2. 承認されるまで接続は保留
3. 管理者が `/_admin/` でデバイスを承認
4. 承認後はそのデバイスから自由に接続可能

デバイスごとの明示的な承認が必要な、もっとも安全な運用です。

### ゲートウェイトークン（必須）

リモートで Control UI にアクセスするには、ゲートウェイトークンが必須です。クエリで渡します。

```
https://your-worker.workers.dev/?token=YOUR_TOKEN
wss://your-worker.workers.dev/ws?token=YOUR_TOKEN
```

**注意:** トークンが正しくても、新規デバイスは `/_admin/` での承認が必要です。

ローカル開発のみで Access やペアリングを無効にしたい場合は、`.dev.vars` で `DEV_MODE=true` にします。

## 永続ストレージ（R2）

デフォルトでは、コンテナ再起動で設定・ペアリング・会話履歴は失われます。R2 を設定するとセッションをまたいで保持できます。

### 1. R2 API トークンの作成

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) の **R2** > **Overview**
2. **Manage R2 API Tokens** をクリック
3. **Object Read & Write** 権限のトークンを新規作成
4. `moltbot-data` バケット（初回デプロイで自動作成）を選択
5. **Access Key ID** と **Secret Access Key** を控える

### 2. シークレットの設定

```bash
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put CF_ACCOUNT_ID
```

Account ID はダッシュボードのアカウント名横の `...` → 「Copy Account ID」で取得できます。

### 動作の概要

- **起動時:** R2 にバックアップがあれば、OpenClaw の設定ディレクトリにリストア
- **稼働中:** 5 分ごとに設定を R2 に同期。管理画面の「Backup Now」で手動同期も可能
- **管理画面:** R2 設定時は「Last backup: [日時]」と「Backup Now」が表示される

R2 を設定しない場合も動作しますが、再起動でデータは消えます。

## コンテナのライフサイクル

デフォルトはコンテナを無期限に起動したまま（`SANDBOX_SLEEP_AFTER=never`）です。コールドスタートが 1〜2 分かかるため、この運用が推奨されます。

利用頻度が低い場合は、無稼働後にスリープさせることもできます。

```bash
npx wrangler secret put SANDBOX_SLEEP_AFTER
# 入力例: 10m または 1h, 30m など
```

スリープ後は次のリクエストでコールドスタートします。R2 を設定していれば、ペアリングとデータは再起動後も保持されます。

## 管理 UI の機能

![admin ui](./assets/adminui.png)

`/_admin/` では次の操作ができます。

- **R2 ストレージ** — 設定状況、最終バックアップ日時、「Backup Now」ボタン
- **ゲートウェイ再起動** — OpenClaw ゲートウェイプロセスの再起動
- **デバイスペアリング** — 保留中のリクエスト一覧、個別／一括承認、ペアリング済みデバイス一覧

管理 UI の利用には Cloudflare Access 認証が必要です（ローカルでは `DEV_MODE=true` でスキップ可能）。

## デバッグ用エンドポイント

`DEBUG_ROUTES=true` かつ Cloudflare Access で保護されている場合、`/debug/*` が有効になります。

- `GET /debug/processes` — コンテナ内の全プロセス一覧（`?logs=true` でログ取得、`?failed=1` で失敗のみ）
- `GET /debug/logs?id=<process_id>` — 指定プロセスのログ
- `GET /debug/version` — コンテナ・OpenClaw のバージョン情報

## オプション: チャット連携

moltworker のコンテナでは **Telegram / Discord / Slack** のトークンを設定して連携できます。OpenClaw 本体は WhatsApp、Google Chat、Signal、iMessage、BlueBubbles、Microsoft Teams、Matrix、Zalo、WebChat などにも対応しています。各チャネルの詳細は [OpenClaw ドキュメント（Channels）](https://docs.openclaw.ai/) を参照してください。

### Telegram

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npm run deploy
```

### Discord

```bash
npx wrangler secret put DISCORD_BOT_TOKEN
npm run deploy
```

### Slack

```bash
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_APP_TOKEN
npm run deploy
```

## オプション: ブラウザ自動操作（CDP）

Chrome DevTools Protocol (CDP) のシムにより、OpenClaw からヘッドレスブラウザを操作できます（スクレイピング、スクリーンショット、自動テストなど）。

### 設定

1. 認証用の共有シークレットを設定:

```bash
npx wrangler secret put CDP_SECRET
# 安全なランダム文字列を入力
```

2. Worker の公開 URL を設定:

```bash
npx wrangler secret put WORKER_URL
# 例: https://your-worker.workers.dev
```

3. 再デプロイ: `npm run deploy`

### エンドポイント

| エンドポイント | 説明 |
|----------------|------|
| `GET /cdp/json/version` | ブラウザバージョン |
| `GET /cdp/json/list` | ブラウザターゲット一覧 |
| `GET /cdp/json/new` | 新規ターゲット作成 |
| `WS /cdp/devtools/browser/{id}` | CDP 用 WebSocket |

いずれも `?secret=<CDP_SECRET>` で認証が必要です。

## 組み込みスキル

コンテナ内の `/root/clawd/skills/` にスキルが同梱されています。

### cloudflare-browser

CDP 経由のブラウザ操作。`CDP_SECRET` と `WORKER_URL` の設定が必要です。

- `screenshot.js` — URL のスクリーンショット
- `video.js` — 複数 URL から動画作成
- `cdp-client.js` — CDP クライアントライブラリ

使用例:

```bash
node /root/clawd/skills/cloudflare-browser/scripts/screenshot.js https://example.com output.png
node /root/clawd/skills/cloudflare-browser/scripts/video.js "https://site1.com,https://site2.com" output.mp4 --scroll
```

詳細は `skills/cloudflare-browser/SKILL.md` を参照してください。

## オプション: Cloudflare AI Gateway

[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) 経由で API をルーティングすると、キャッシュ・レート制限・分析・コスト把握ができます。OpenClaw は AI Gateway をネイティブでサポートしています。

### 設定

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway/create-gateway) で AI Gateway を作成
2. 次の 3 つのシークレットを設定:

```bash
# AI プロバイダーの API キー（例: Anthropic）。ゲートウェイ経由でプロバイダーに渡されます
npx wrangler secret put CLOUDFLARE_AI_GATEWAY_API_KEY

# Cloudflare アカウント ID
npx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID

# AI Gateway ID（ゲートウェイ概要ページから）
npx wrangler secret put CF_AI_GATEWAY_GATEWAY_ID
```

3. 再デプロイ: `npm run deploy`

AI Gateway を設定すると、直接の `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` より優先されます。

### モデルの指定

デフォルトは Anthropic Claude Sonnet 4.5 です。別モデル・別プロバイダーにするには `CF_AI_GATEWAY_MODEL` を `provider/model-id` 形式で設定します。

```bash
npx wrangler secret put CF_AI_GATEWAY_MODEL
# 例: workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast
```

[AI Gateway のプロバイダー](https://developers.cloudflare.com/ai-gateway/usage/providers/) に対応しています。

| プロバイダー | 例 | API キー |
|--------------|-----|----------|
| Workers AI | `workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Cloudflare API トークン |
| OpenAI | `openai/gpt-4o` | OpenAI API キー |
| Anthropic | `anthropic/claude-sonnet-4-5` | Anthropic API キー |
| Groq | `groq/llama-3.3-70b` | Groq API キー |

**注意:** `CLOUDFLARE_AI_GATEWAY_API_KEY` は利用するプロバイダーに合わせて設定し、ゲートウェイ経由で 1 プロバイダーのみ利用できます。

#### Workers AI の Unified Billing

[Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) を使うと、別途プロバイダー API キーなしで Workers AI モデルを利用できます。`CLOUDFLARE_AI_GATEWAY_API_KEY` に [AI Gateway の認証トークン](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)（`cf-aig-authorization`）を設定します。

### 従来の AI Gateway 設定

`AI_GATEWAY_API_KEY` + `AI_GATEWAY_BASE_URL` の組み合わせも互換のためサポートされていますが、上記のネイティブ設定を推奨します。

## シークレット一覧

| シークレット | 必須 | 説明 |
|--------------|------|------|
| `CLOUDFLARE_AI_GATEWAY_API_KEY` | 条件付き* | AI プロバイダーの API キー。`CF_AI_GATEWAY_ACCOUNT_ID` と `CF_AI_GATEWAY_GATEWAY_ID` とセット |
| `CF_AI_GATEWAY_ACCOUNT_ID` | 条件付き* | Cloudflare アカウント ID |
| `CF_AI_GATEWAY_GATEWAY_ID` | 条件付き* | AI Gateway ID |
| `CF_AI_GATEWAY_MODEL` | 任意 | モデル上書き。`provider/model-id` 形式 |
| `ANTHROPIC_API_KEY` | 条件付き* | Anthropic API キー（AI Gateway の代わりに直接利用） |
| `ANTHROPIC_BASE_URL` | 任意 | Anthropic API のベース URL |
| `OPENAI_API_KEY` | 任意 | OpenAI API キー（別プロバイダー） |
| `AI_GATEWAY_API_KEY` | 任意 | 従来の AI Gateway キー（非推奨） |
| `AI_GATEWAY_BASE_URL` | 任意 | 従来の AI Gateway URL（非推奨） |
| `CF_ACCESS_TEAM_DOMAIN` | 条件付き* | Cloudflare Access チームドメイン（管理 UI 用） |
| `CF_ACCESS_AUD` | 条件付き* | Cloudflare Access の AUD（管理 UI 用） |
| `MOLTBOT_GATEWAY_TOKEN` | 必須 | ゲートウェイトークン（`?token=` で渡す） |
| `DEV_MODE` | 任意 | `true` で Access 認証・ペアリングをスキップ（ローカル用） |
| `DEBUG_ROUTES` | 任意 | `true` で `/debug/*` を有効化 |
| `SANDBOX_SLEEP_AFTER` | 任意 | スリープまでの無稼働時間。`never`（デフォルト）または `10m`, `1h` など |
| `R2_ACCESS_KEY_ID` | 任意 | R2 アクセスキー |
| `R2_SECRET_ACCESS_KEY` | 任意 | R2 シークレットキー |
| `CF_ACCOUNT_ID` | 任意 | Cloudflare アカウント ID（R2 用） |
| `TELEGRAM_BOT_TOKEN` | 任意 | Telegram ボットトークン |
| `TELEGRAM_DM_POLICY` | 任意 | `pairing`（デフォルト）または `open` |
| `DISCORD_BOT_TOKEN` | 任意 | Discord ボットトークン |
| `DISCORD_DM_POLICY` | 任意 | `pairing` または `open` |
| `SLACK_BOT_TOKEN` | 任意 | Slack ボットトークン |
| `SLACK_APP_TOKEN` | 任意 | Slack アプリトークン |
| `CDP_SECRET` | 任意 | CDP 認証用シークレット |
| `WORKER_URL` | 任意 | Worker の公開 URL（CDP 用） |

## Cloudflare Sandbox でうまく運用するために

moltworker は Cloudflare Sandbox 上で OpenClaw を動かすため、以下の制約と対策を押さえておくと運用しやすくなります。

### 本番デプロイを推奨

- **ローカル（`wrangler dev`）** では、Sandbox 経由の **WebSocket プロキシに制限**があり、Control UI の WebSocket が失敗することがあります。HTTP や管理画面の表示は動いても、チャットの双方向通信が不安定になる場合があります。
- **本番にデプロイ**（`npm run deploy`）すると、WebSocket は通常どおり動作します。問題が再現する場合は本番で確認してください。
- 参考: [Cloudflare Sandbox — WebSocket Connections](https://developers.cloudflare.com/sandbox/guides/websocket-connections/)

### サブリクエスト制限対策（SANDBOX_TRANSPORT）

Worker から Sandbox への API 呼び出し（`listProcesses`、`getLogs`、`exec` など）は、デフォルトでは **1 操作につき 1 サブリクエスト** として数えられます（Workers 有料で 1 リクエストあたり 1,000 まで）。

このリポジトリでは **`SANDBOX_TRANSPORT = "websocket"`** を `wrangler.jsonc` の `vars` に設定しています。これにより Sandbox SDK が **1 本の WebSocket で多重化**して通信するため、サブリクエストを節約し、デバイス一覧や `/debug/processes?logs=true` など多数の操作を行うリクエストでも制限に当たりにくくなります。アプリ側のコード変更は不要です。

- 参考: [Transport modes — Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/configuration/transport/)

### コールドスタートとスリープ

- **初回リクエスト**はコンテナの起動のため **1〜2 分**かかることがあります。
- デフォルトではコンテナは **スリープしません**（`SANDBOX_SLEEP_AFTER=never`）。コールドスタートを避けたい場合はこのままで問題ありません。
- コスト削減のために `SANDBOX_SLEEP_AFTER=10m` などでスリープさせる場合は、次のアクセスで再度コールドスタートが発生することを想定してください。R2 を有効にしていれば、再起動後もペアリング・会話履歴は保持されます。

### まとめ

| 事象 | 対処 |
|------|------|
| ローカルで WebSocket / チャットが不安定 | 本番デプロイで確認。本番で問題なければ wrangler dev の制限と考えてよい |
| デバイス一覧やデバッグが遅い・制限に当たりそう | `SANDBOX_TRANSPORT=websocket` を利用（本リポジトリは既定で有効） |
| 初回だけ非常に遅い | コールドスタート（1〜2 分）は仕様。2 回目以降は速くなる |
| Windows で exit 126 | `.gitattributes` で `*.sh` を LF に。`git config core.autocrlf input` も有効 |

## セキュリティ

OpenClaw は次の 3 層で認証されています。

1. **Cloudflare Access** — `/_admin/`, `/api/*`, `/debug/*` を保護。認証済みユーザーのみ管理可能
2. **ゲートウェイトークン** — Control UI アクセスに必須。`?token=` で渡す。漏らさないこと
3. **デバイスペアリング** — 各デバイスは管理画面で明示的に承認されるまでアシスタントとやり取りできません（デフォルトの DM ポリシーは `pairing`）

## トラブルシューティング

**`npm run dev` が `Unauthorized` になる:** [Containers ダッシュボード](https://dash.cloudflare.com/?to=/:account/workers/containers) で Cloudflare Containers を有効にしてください。

**ゲートウェイが起動しない:** `npx wrangler secret list` と `npx wrangler tail` で確認してください。

**設定変更が反映されない:** `Dockerfile` の `# Build cache bust:` のコメントを編集してから再デプロイしてください。

**初回が遅い:** コールドスタートは 1〜2 分かかります。2 回目以降は速くなります。

**R2 がマウントされない:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ACCOUNT_ID` の 3 つが設定されているか確認してください。R2 マウントは本番環境のみで、`wrangler dev` では動作しません。

**管理画面で Access 拒否される:** `CF_ACCESS_TEAM_DOMAIN` と `CF_ACCESS_AUD` が設定され、Access アプリの設定が正しいか確認してください。

**管理画面にデバイスが出ない:** デバイス一覧取得は WebSocket の都合で 10〜15 秒かかります。少し待ってから再読み込みしてください。

**ローカルで WebSocket が動かない:** 上記「[Cloudflare Sandbox でうまく運用するために](#cloudflare-sandbox-でうまく運用するために)」を参照。本番デプロイで問題なければ wrangler dev の既知の制限です。

## 既知の問題

### Windows: ゲートウェイが exit code 126 で起動しない

Windows では Git がシェルスクリプトを CRLF でチェックアウトすることがあり、Linux コンテナ内の `start-openclaw.sh` が exit 126 で失敗します。リポジトリで LF を使うようにしてください（`git config --global core.autocrlf input` または `.gitattributes` に `* text=auto eol=lf`）。詳細は [issue #64](https://github.com/cloudflare/moltworker/issues/64) を参照してください。

## リンク

- [OpenClaw](https://github.com/openclaw/openclaw) — 本体リポジトリ（194k+ stars）
- [openclaw.ai](https://openclaw.ai) — 公式サイト
- [OpenClaw ドキュメント](https://docs.openclaw.ai/) — セットアップ・設定・チャネル・リモートアクセス
- [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) — [Transport modes](https://developers.cloudflare.com/sandbox/configuration/transport/)（WebSocket トランスポート）、[WebSocket Connections](https://developers.cloudflare.com/sandbox/guides/websocket-connections/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
