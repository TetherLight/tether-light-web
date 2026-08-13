// 静的ページ（index / contact / thanks）のheadを、SEOメタ情報一式に差し替える。
// テンプレート由来のページ（news / works）は各ビルドスクリプト側で組み立てるため、ここでは扱わない。

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { replaceMarker } from "./lib/markers.mjs";
import { renderHead, SITE_NAME, SITE_URL, absoluteUrl } from "./lib/seo.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/**
 * トップページに入れる Organization の構造化データ。
 * ニュース詳細の NewsArticle とは別物で、そちらには手を入れない。
 */
function renderOrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: SITE_NAME,
    // 日本語表記でも社名を引き当てられるよう、読み仮名を含む別名を登録する
    alternateName: ["Tether Light", "テザーライト", "株式会社テザーライト"],
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/images/logo-icon-blue.png`,
    foundingDate: "2024-05",
    address: {
      "@type": "PostalAddress",
      addressCountry: "JP",
      postalCode: "951-8067",
      addressRegion: "新潟県",
      addressLocality: "新潟市中央区",
      streetAddress: "本町通7番町1098-1 WorkWith本町",
    },
    // 構造化データには計測用パラメータを除いた正規URLを使う
    sameAs: ["https://www.instagram.com/camerasekai"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: absoluteUrl("contact.html"),
      availableLanguage: ["Japanese"],
    },
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/** 静的ページごとのメタ情報。descriptionは検索結果を想定して120字前後に収めている。 */
const PAGES = [
  {
    file: "index.html",
    // トップだけは社名を先頭に置く
    fullTitle: `${SITE_NAME} | 新潟の写真・動画制作`,
    description:
      "新潟を拠点に、写真・動画の撮影とSNSメディアの企画・運営を行う株式会社Tether Light（テザーライト）です。商品撮影、イベント撮影、企業PR動画、SNSショート動画まで、企画から編集までワンストップで対応します。",
    extraHead: renderOrganizationJsonLd(),
  },
  {
    file: "contact.html",
    title: "お問い合わせ",
    description:
      "株式会社Tether Light（テザーライト）へのお問い合わせフォームです。新潟での撮影のご依頼、SNSメディアの企画・運営のご相談など、些細なことでもお気軽にお問い合わせください。",
  },
  {
    file: "thanks.html",
    title: "送信完了",
    description: "お問い合わせいただきありがとうございます。担当者より折り返しご連絡いたします。",
    // 送信完了ページが検索結果に出ないようにする
    noindex: true,
  },
];

export async function buildSeo() {
  console.log("[build-seo] 静的ページのメタ情報を書き込んでいます…");

  for (const page of PAGES) {
    const filePath = path.join(DIST, page.file);
    const html = await readFile(filePath, "utf-8");

    const head = renderHead({
      title: page.title,
      fullTitle: page.fullTitle,
      description: page.description,
      path: page.file,
      ogType: "website",
      noindex: page.noindex,
      extraHead: page.extraHead,
    });

    await writeFile(filePath, replaceMarker(html, "HEAD", `\n${head}\n`), "utf-8");
  }

  console.log(`[build-seo] ${PAGES.length}ページに書き込みました。`);
}
