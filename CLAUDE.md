# Tether Light コーポレートサイト

株式会社Tether Light（tetherlight.jp）のコーポレートサイト。素のHTML/CSS/JSで作り、
ニュース・実績の本文だけを microCMS から取得してビルド時に静的HTMLへ焼き込む構成。
フレームワークもnpm依存パッケージも使っていない（ビルドスクリプトはNode標準APIのみ）。

## リポジトリ

- `github.com/TetherLight/tether-light-web` / ブランチは `main` のみ
- 本番: https://tetherlight.jp （GitHub Pages + `CNAME`）

## ディレクトリ構成

```
index.html contact.html thanks.html   静的ページ（ソース）
css/style.css                          サイト全体のCSS（1ファイル）
js/script.js                           ナビ・スクロール演出など全ページ共通
js/works.js                            実績一覧の絞り込み
news/ works/                           ソース側のサンプルHTML。本番の中身はビルドで再生成される
templates/                             microCMSの内容を流し込む雛形（news/works の一覧・詳細）
scripts/                               ビルドスクリプト一式
images/ fonts/                         画像・自前ホストのフォント
dist/                                  ビルド出力。gitignore済み（GitHub Actionsが実行時に生成）
design-spec.md                         STUDIO再現用のデザイン仕様書（実測値ベース）
画像/                                  写真整理用の作業フォルダ。サイトのソースではない（gitignore済み）
```

## ビルド

エントリーポイントは `scripts/build.mjs`。実行順に意味がある:

1. `build-news.mjs` — 最初に `dist/` を作り、静的アセットをコピーする。以降のスクリプトはこの `dist/` に追記する前提
2. `build-works.mjs`
3. `build-seo.mjs` — 静的ページの `<head>` を差し替える
4. `build-sitemap.mjs` — `dist/` を走査するので必ず最後

```bash
node scripts/build.mjs
```

必要な環境変数は `.env.example` を参照（`MICROCMS_API_KEY` / `MICROCMS_SERVICE_DOMAIN` / `SITE_URL`）。
`.env` はgitignore済み。CIでは GitHub の Secrets / Variables から渡している。

### BUILD マーカー方式

ソースHTMLに `<!-- BUILD:NAME:START -->` … `<!-- BUILD:NAME:END -->` を置き、
その間だけをビルド時に差し替える（`scripts/lib/markers.mjs`）。マーカー自体は残す。
トップページのニュース最新3件、実績へのナビゲーションリンク、事業セクションのビジュアルなどがこれ。

**ソースHTMLを編集するときはマーカーを消さないこと。** 消えるとビルドが例外で止まる。

## デプロイ

`.github/workflows/deploy.yml` — `main` への push、`workflow_dispatch`、および
microCMS からの `repository_dispatch` (`microcms-publish`) で発火し、ビルドして GitHub Pages へ公開する。
記事を書いただけでもサイトが更新されるのはこの webhook 経由。

## ローカルでの確認

`dist/` を静的配信して見る（ポート8080）。`.claude/launch.json` に2つ用意してある。

| 設定名 | 用途 |
|---|---|
| `dist-server` | Windows機。`scripts/serve-dist.mjs` をフルパス指定のNodeで動かす |
| `dist-server-mac` | Mac。Nodeが無いため `scripts/serve-dist.py` で代用する |

`.claude/` は gitignore 済みなので、この設定はリポジトリ経由では同期されない。
実体はT7ドライブ上にあり、ドライブごと持ち運ぶ前提。

## 開発上の注意

- **同じT7ドライブを macOS と Windows の両方に挿して作業している。**
  元々はWindows機で構築した（`scripts/generate-images.ps1` はPowerShell）。
  パスの扱いを書くときは `node:path` を使い、区切り文字をベタ書きしない。
- **Node が入っているのは Windows機だけ。** Mac側では `node scripts/build.mjs` が実行できず、
  ビルド結果の確認は既存の `dist/` を配信する形になる。
  Mac で表示確認だけしたい場合は、`css/` や `index.html` の変更を `dist/` 側にも
  手でコピーする必要がある（`dist/index.html` はビルド済みの `<head>` を持つため、
  ソースの `index.html` で丸ごと上書きしないこと）。
- コード内のコメントは日本語で書く。既存コードがすべてそうなっている。
- CSSは変数（`--color-*` など）を `:root` に定義して使う。値のベタ書きは避ける。色の一覧は `design-spec.md` にある。
- ブレークポイントは `1024px` / `860px` / `480px` の3段階。
