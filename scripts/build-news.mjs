// ニュース機能のビルドスクリプト。
// microCMSの "news" エンドポイントから全記事を取得し、以下を静的HTMLとして生成する。
//   - dist/news/{id}.html          … 記事詳細ページ
//   - dist/news/index.html         … ニュース一覧（1ページ目）
//   - dist/news/page/{n}.html      … ニュース一覧（2ページ目以降、20件ごと）
//   - dist/index.html のニュース欄  … 最新3件を差し込む
//
// dist/ フォルダの作成・静的アセットのコピーはこのスクリプトが最初に行う。
// （build-works.mjs は、このスクリプトが作った dist/ に追記する前提）

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchAllContents, getSiteUrl } from "./lib/microcms.mjs";
import { render } from "./lib/render.mjs";
import { excerpt, escapeHtml } from "./lib/html.mjs";
import { cropImage, resizeImage } from "./lib/image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = getSiteUrl();
const PAGE_SIZE = 20;
const LATEST_START = "<!-- BUILD:NEWS_LATEST:START -->";
const LATEST_END = "<!-- BUILD:NEWS_LATEST:END -->";

function formatDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

async function prepareDist() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const name of ["css", "js", "images", "fonts"]) {
    await cp(path.join(ROOT, name), path.join(DIST, name), { recursive: true });
  }
  for (const name of ["index.html", "contact.html", "thanks.html"]) {
    await cp(path.join(ROOT, name), path.join(DIST, name));
  }
}

function renderNewsItem(article, linkPrefix, eager) {
  const thumb = cropImage(article.thumbnail, 360, 240) || "../images/logo-icon-blue.png";
  return `        <a href="${linkPrefix}${article.id}.html" class="news-item">
          <img src="${thumb}" alt="" class="news-item__thumb" width="180" height="120" ${eager ? "" : 'loading="lazy"'}>
          <div class="news-item__content">
            <div class="news-item__meta">
              <span class="news-item__category">${escapeHtml(article.category || "")}</span>
              <span class="news-item__date">${formatDate(article.publishedDate)}</span>
            </div>
            <span class="news-item__title">${escapeHtml(article.title)}</span>
          </div>
          <span class="news-item__arrow">→</span>
        </a>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return "";
  const pageHref = (n) => (n === 1 ? "index.html" : `page/${n}.html`);
  const parts = [];
  if (currentPage > 1) {
    parts.push(`<a href="${pageHref(currentPage - 1)}" class="news-viewall">← 前へ</a>`);
  }
  parts.push(
    `<span class="form-hint" style="text-align:center;">${currentPage} / ${totalPages}ページ</span>`
  );
  if (currentPage < totalPages) {
    parts.push(
      `<a href="${pageHref(currentPage + 1)}" class="news-viewall">次へ<span class="btn__arrow">→</span></a>`
    );
  }
  return `    <div class="article__actions">\n      ${parts.join("\n      ")}\n    </div>`;
}

async function buildListPages(articles, template) {
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  await mkdir(path.join(DIST, "news", "page"), { recursive: true });

  for (let page = 1; page <= totalPages; page++) {
    const pageItems = articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const itemsHtml =
      pageItems.length > 0
        ? pageItems.map((a, i) => renderNewsItem(a, "", page === 1 && i === 0)).join("\n")
        : `        <p class="form-hint" style="padding: 24px 4px;">現在、公開中のニュースはありません。</p>`;

    const html = render(template, {
      pageTitle: totalPages > 1 ? `ニュース一覧（${page}/${totalPages}）` : "ニュース一覧",
      items: itemsHtml,
      pagination: renderPagination(page, totalPages),
    });

    const outPath =
      page === 1
        ? path.join(DIST, "news", "index.html")
        : path.join(DIST, "news", "page", `${page}.html`);
    await writeFile(outPath, html, "utf-8");
  }
}

async function buildDetailPages(articles, template) {
  for (const article of articles) {
    const ogImageObj = resizeImage(article.thumbnail, 1200);
    const ogImage = ogImageObj ? ogImageObj.url : `${SITE_URL}/images/logo-icon-blue.png`;
    const ogUrl = `${SITE_URL}/news/${article.id}.html`;
    const detailImage = resizeImage(article.thumbnail, 1200);

    const thumbnailBlock = detailImage
      ? `    <img src="${detailImage.url}" alt="${escapeHtml(article.title)}" class="article__thumb" width="${detailImage.width}" height="${detailImage.height}">`
      : "";

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: article.title,
      image: [ogImage],
      datePublished: article.publishedDate,
      dateModified: article.updatedAt || article.publishedDate,
      author: { "@type": "Organization", name: "Tether Light" },
      publisher: {
        "@type": "Organization",
        name: "Tether Light",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/images/logo-icon-blue.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": ogUrl },
    });

    const html = render(template, {
      pageTitle: article.title,
      title: escapeHtml(article.title),
      category: escapeHtml(article.category || ""),
      dateFormatted: formatDate(article.publishedDate),
      dateISO: article.publishedDate,
      thumbnailBlock,
      bodyHtml: article.body || "",
      ogTitle: escapeHtml(article.title),
      ogDescription: escapeHtml(excerpt(article.body || "", 100)),
      ogImage,
      ogUrl,
      jsonLd,
    });

    await writeFile(path.join(DIST, "news", `${article.id}.html`), html, "utf-8");
  }
}

async function patchTopPage(articles) {
  const indexPath = path.join(DIST, "index.html");
  const html = await readFile(indexPath, "utf-8");

  const startIdx = html.indexOf(LATEST_START);
  const endIdx = html.indexOf(LATEST_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("index.html に News の差し込みマーカーが見つかりません。");
  }

  const latest = articles.slice(0, 3);
  const itemsHtml = latest.map((a, i) => renderNewsItem(a, "news/", i === 0)).join("\n");

  const patched =
    html.slice(0, startIdx) +
    LATEST_START +
    "\n" +
    itemsHtml +
    "\n        " +
    LATEST_END +
    html.slice(endIdx + LATEST_END.length);

  await writeFile(indexPath, patched, "utf-8");
}

export async function buildNews() {
  console.log("[build-news] dist/ を準備しています…");
  await prepareDist();

  console.log("[build-news] microCMSから記事を取得しています…");
  const articles = await fetchAllContents("news", { orders: "-publishedDate" });
  console.log(`[build-news] ${articles.length}件の記事を取得しました。`);

  const listTemplate = await readFile(path.join(ROOT, "templates", "news-list.html"), "utf-8");
  const detailTemplate = await readFile(path.join(ROOT, "templates", "news-detail.html"), "utf-8");

  await buildListPages(articles, listTemplate);
  await buildDetailPages(articles, detailTemplate);
  await patchTopPage(articles);

  console.log("[build-news] 完了しました。");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  buildNews().catch((err) => {
    console.error("[build-news] エラー:", err);
    process.exit(1);
  });
}
