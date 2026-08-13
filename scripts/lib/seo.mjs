// サイト全体のSEOメタ情報を1箇所で組み立てる。
// OGPの画像・URLは絶対URLである必要があり、SITE_URL はビルド時にしか確定しないため、
// title/description も含めてビルド時にheadへ差し込む方式にしている。

import { getSiteUrl } from "./microcms.mjs";
import { escapeHtml, stripHtml } from "./html.mjs";

export const SITE_NAME = "株式会社Tether Light";
export const SITE_URL = getSiteUrl();

/** description に使う文字数。検索結果での表示上限に合わせている。 */
export const DESCRIPTION_LENGTH = 120;

/** サムネイルを持たないページで使う共通のOGP画像（1200x630）。 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-default.png`;

/**
 * サイトルートからのパスを絶対URLにする。
 * 末尾の index.html は取り除き、ディレクトリ形式に正規化する
 * （同じ内容が /news/ と /news/index.html の2つのURLで引けてしまうのを避けるため）。
 *
 * @param {string} pathname 例: "news/index.html" → "https://example.com/news/"
 */
export function absoluteUrl(pathname) {
  const clean = String(pathname || "")
    .replace(/^\/+/, "")
    .replace(/(^|\/)index\.html$/, "$1");
  return clean ? `${SITE_URL}/${clean}` : `${SITE_URL}/`;
}

/**
 * 本文から description を作る。HTMLタグを除去して先頭を切り出す。
 * @param {string} source 本文（HTMLでも可）
 * @param {string} fallback 本文が空のときに使う文字列
 */
export function buildDescription(source, fallback = "") {
  const text = stripHtml(source);
  if (!text) return fallback;
  return text.length > DESCRIPTION_LENGTH ? text.slice(0, DESCRIPTION_LENGTH) + "…" : text;
}

/**
 * ファビコン関連のlinkタグ。全ページ共通。
 * サイトルート基準の絶対パスにして、階層の違うページでも同じ文字列を使えるようにする。
 */
const FAVICON_TAGS = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/images/favicon/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/images/favicon/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/images/favicon/apple-touch-icon.png">`;

/**
 * head に差し込むメタ情報一式を組み立てる。
 *
 * @param {object} options
 * @param {string} options.title       ページ固有のタイトル（末尾にサイト名が自動で付く）
 * @param {string} [options.fullTitle] タイトル全体を指定したいとき（サイト名は付かない）
 * @param {string} options.description
 * @param {string} options.path        サイトルートからのパス（例: "news/index.html"）
 * @param {string} [options.ogType]    "website" | "article"
 * @param {string} [options.ogImage]   省略時は共通OGP画像
 * @param {boolean} [options.noindex]  検索結果に出したくないページで true
 * @param {string} [options.extraHead] JSON-LD など、追加で入れたいタグ
 * @returns {string}
 */
export function renderHead({
  title,
  fullTitle: fullTitleOverride,
  description,
  path,
  ogType = "website",
  ogImage,
  noindex = false,
  extraHead = "",
}) {
  const fullTitle = fullTitleOverride || (title ? `${title} | ${SITE_NAME}` : SITE_NAME);
  const url = absoluteUrl(path);
  const image = ogImage || DEFAULT_OG_IMAGE;

  const lines = [
    `<title>${escapeHtml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
  ];

  if (noindex) {
    lines.push(`<meta name="robots" content="noindex, follow">`);
  }

  lines.push(
    "",
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    // 画像URLにはクエリパラメータの & が含まれるため、属性値としてエスケープする
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    "",
    FAVICON_TAGS
  );

  if (extraHead) {
    lines.push("", extraHead);
  }

  return lines.join("\n");
}
