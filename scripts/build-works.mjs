// 実績（Works）機能のビルドスクリプト。
// microCMSの "services"（事業内容）・"works"（案件）エンドポイントから全件取得し、
// 以下を静的HTMLとして生成する。
//   - dist/works/{id}.html   … 案件詳細ページ
//   - dist/works/index.html  … 実績一覧（カテゴリタブ・全案件データを埋め込み）
//   - dist/index.html        … 事業内容セクションの画像・リンク、ヘッダー/フッターの
//                               「実績」導線を、実データの有無に応じて差し込む
//
// 事業内容セクションのタイトル・説明文・タグは静的HTML（index.html）が正のデータとして
// 残る。microCMSの services に存在する事業だけ、画像スライドショーと「実績を見る」リンクを
// 動的に差し込み、存在しない事業は既存のHTML表示のまま変更しない。
//
// このスクリプトは dist/ フォルダが既に存在すること（build-news.mjs が先に実行され、
// 静的アセットのコピーが済んでいること）を前提にしている。dist/ の作り直しは行わない。

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchAllContents } from "./lib/microcms.mjs";
import { render } from "./lib/render.mjs";
import { escapeHtml } from "./lib/html.mjs";
import { cropImage, resizeImage, youTubeEmbedUrl } from "./lib/image.mjs";
import { replaceMarker, replaceKeyedMarkers } from "./lib/markers.mjs";
import { DEFAULT_OG_IMAGE, buildDescription, renderHead } from "./lib/seo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// ---- 事業内容セクション（トップページ）の差し込み ----

// Fisher-Yatesシャッフル。ビルドごとに並び順をランダム化する。
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function renderSlidesInner(worksForService) {
  const photos = shuffle(worksForService.filter((w) => w.thumbnail));
  if (photos.length === 0) return null;

  return photos
    .map((w, i) => {
      const thumb = cropImage(w.thumbnail, 800, 600);
      // 1枚目だけ最初から読み込み、2枚目以降は data-src で待機させる。
      // 全枚数を一度に読み込むとトップページが重くなるため、
      // 表示が近づいたものだけを js/script.js が順次読み込む。
      const source = i === 0 ? `src="${thumb}"` : `data-src="${thumb}"`;
      return `              <img ${source} alt="" class="business-item__slide${i === 0 ? " is-active" : ""}">`;
    })
    .join("\n");
}

async function patchServiceVisuals(html, services, works) {
  return replaceKeyedMarkers(html, "SERVICE_VISUAL", (title, originalInner) => {
    const service = services.find((s) => s.title.trim() === title);
    if (!service) return originalInner; // 該当サービスが無ければ既存HTMLのまま

    const worksForService = works.filter((w) => w.service && w.service.id === service.id);
    const slides = renderSlidesInner(worksForService);
    return slides === null ? originalInner : `\n${slides}\n              `;
  });
}

async function patchServiceLinks(html, services) {
  return replaceKeyedMarkers(html, "SERVICE_LINK", (title) => {
    const service = services.find((s) => s.title.trim() === title);
    if (!service) return ""; // 該当サービスが無ければリンクを出さない
    return `<a href="works/index.html?service=${service.id}" class="business-item__cta">この事業の実績を見る<span class="btn__arrow">→</span></a>`;
  });
}

// works が0件なら「実績」ナビリンクのマーカーを空にする。
// 1件以上ある場合は、テンプレート/index.htmlに書かれている導線をそのまま残す
// （replaceMarker を呼ばない = マーカー間の内容はそのまま保持される）。
function patchWorksNav(html, works) {
  if (works.length === 0) {
    html = replaceMarker(html, "WORKS_NAV_HEADER", "");
    html = replaceMarker(html, "WORKS_NAV_FOOTER", "");
  }
  return html;
}

async function patchTopPage(services, works) {
  const indexPath = path.join(DIST, "index.html");
  let html = await readFile(indexPath, "utf-8");

  html = await patchServiceVisuals(html, services, works);
  html = await patchServiceLinks(html, services);

  await writeFile(indexPath, html, "utf-8");
}

// dist/ 配下の再帰的な .html ファイル一覧を返す。
async function listHtmlFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch {
    return []; // フォルダが無ければ対象なし
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

// トップページ・ニュース関連ページ・実績関連ページすべてに、
// works の有無に応じた「実績」ナビの出し分けを適用する。
// サイト全体でヘッダー/フッターのナビ表示を統一するため。
async function patchWorksNavEverywhere(works) {
  const targets = [
    path.join(DIST, "index.html"),
    ...(await listHtmlFiles(path.join(DIST, "news"))),
    ...(await listHtmlFiles(path.join(DIST, "works"))),
  ];

  for (const filePath of targets) {
    const html = await readFile(filePath, "utf-8");
    const patched = patchWorksNav(html, works);
    if (patched !== html) {
      await writeFile(filePath, patched, "utf-8");
    }
  }
}

// ---- 実績一覧ページ ----

function renderTab(id, label, isActive) {
  return `      <button type="button" class="works-tabs__item${isActive ? " is-active" : ""}" data-service="${id}">${escapeHtml(label)}</button>`;
}

function renderTabsBlock(services) {
  if (services.length < 2) return ""; // カテゴリが1つ以下ならタブ自体を出さない

  const tabsHtml = [
    renderTab("all", "すべて", true),
    ...services.map((s) => renderTab(s.id, s.title, false)),
  ].join("\n");

  return `    <div class="works-tabs" id="worksTabs" data-animate>
${tabsHtml}
    </div>`;
}

// カードのメタ欄も、値のある項目だけを出力する（空の span で余白が空くのを防ぐ）。
function renderCardMeta(work, indent) {
  const spans = [];
  if (work.client) spans.push(`<span>${escapeHtml(work.client)}</span>`);
  if (work.year) spans.push(`<span>${escapeHtml(String(work.year))}</span>`);
  if (spans.length === 0) return "";
  return `\n${indent}<div class="work-card__meta">\n${spans.map((s) => `${indent}  ${s}`).join("\n")}\n${indent}</div>`;
}

function renderWorkCard(work, eager) {
  const thumb = cropImage(work.thumbnail, 800, 600) || "../images/logo-icon-blue.png";
  const serviceId = work.service && work.service.id ? work.service.id : "";
  return `      <a href="${work.id}.html" class="work-card" data-service="${serviceId}" data-order="${work.order ?? 0}">
        <div class="work-card__thumb-wrap">
          <img src="${thumb}" alt="${escapeHtml(work.title)}" class="work-card__thumb" width="800" height="600" ${eager ? "" : 'loading="lazy"'}>
        </div>
        <p class="work-card__title">${escapeHtml(work.title)}</p>${renderCardMeta(work, "        ")}
      </a>`;
}

async function buildWorksList(services, works) {
  const tabsBlock = renderTabsBlock(services);
  const cardsHtml = works.map((w, i) => renderWorkCard(w, i === 0)).join("\n");

  const template = await readFile(path.join(ROOT, "templates", "works-list.html"), "utf-8");
  const html = render(template, {
    head: renderHead({
      title: "実績一覧",
      description:
        "株式会社Tether Lightの撮影実績一覧です。新潟での商品撮影、イベント撮影、企業PR動画、ビジネスポートレートなど、これまで手がけた案件をご紹介します。",
      path: "works/index.html",
    }),
    tabsBlock,
    cardsHtml,
  });

  await mkdir(path.join(DIST, "works"), { recursive: true });
  await writeFile(path.join(DIST, "works", "index.html"), html, "utf-8");
}

// ---- 案件詳細ページ ----

function renderGalleryItem(item, index) {
  if (!item.image) return "";
  const display = resizeImage(item.image, 1600);
  const lightboxSrc = resizeImage(item.image, 2000);
  const caption = item.caption ? `<p class="work-gallery__caption">${escapeHtml(item.caption)}</p>` : "";
  return `      <figure class="work-gallery__item">
        <img
          src="${display.url}"
          data-lightbox-src="${lightboxSrc.url}"
          data-lightbox-caption="${escapeHtml(item.caption || "")}"
          alt="${escapeHtml(item.caption || "")}"
          class="work-gallery__img"
          width="${display.width}"
          height="${display.height}"
          ${index === 0 ? "" : 'loading="lazy"'}
        >
        ${caption}
      </figure>`;
}

// 値が入っている項目だけを span として出力する。
// 全項目が空ならメタ情報の枠自体を出さない。
function renderMetaBlock({ categoryLabel, client, year }) {
  const spans = [];
  if (categoryLabel) spans.push(`      <span class="work-header__category">${escapeHtml(categoryLabel)}</span>`);
  if (client) spans.push(`      <span>${escapeHtml(client)}</span>`);
  if (year) spans.push(`      <span>${escapeHtml(String(year))}年</span>`);
  if (spans.length === 0) return "";
  return `    <div class="work-header__meta">
${spans.join("\n")}
    </div>`;
}

function renderDescriptionBlock(description) {
  if (!description) return "";
  return `    <div class="work-description">${escapeHtml(description).replace(/\n/g, "<br>")}</div>`;
}

function renderGalleryBlock(galleryHtml) {
  if (!galleryHtml) return "";
  return `    <div class="work-gallery" id="workGallery">
${galleryHtml}
    </div>`;
}

function renderPagerBlock(prevLink, nextLink) {
  if (!prevLink && !nextLink) return "";
  return `    <div class="work-pager">
${[prevLink, nextLink].filter(Boolean).join("\n")}
    </div>`;
}

function renderVideoBlock(videoUrl) {
  const embedUrl = youTubeEmbedUrl(videoUrl);
  if (!embedUrl) return "";
  return `    <div class="work-video">
      <iframe src="${embedUrl}" title="video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
    </div>`;
}

function renderRelated(relatedWorks) {
  if (relatedWorks.length === 0) return "";
  const cards = relatedWorks
    .map((w) => {
      const thumb = cropImage(w.thumbnail, 600, 450) || "../images/logo-icon-blue.png";
      return `        <a href="${w.id}.html" class="work-card">
          <div class="work-card__thumb-wrap">
            <img src="${thumb}" alt="${escapeHtml(w.title)}" class="work-card__thumb" width="600" height="450" loading="lazy">
          </div>
          <p class="work-card__title">${escapeHtml(w.title)}</p>${renderCardMeta(w, "          ")}
        </a>`;
    })
    .join("\n");

  return `    <div class="work-related">
      <p class="work-related__heading">RELATED WORKS / 同じ事業カテゴリの実績</p>
      <div class="work-related__grid">
${cards}
      </div>
    </div>`;
}

function renderPagerLink(work, label, modifierClass) {
  if (!work) return "";
  return `      <a href="${work.id}.html" class="work-pager__link ${modifierClass}">
        <span class="work-pager__label">${label}</span>
        <span class="work-pager__title">${escapeHtml(work.title)}</span>
      </a>`;
}

async function buildWorksDetail(works, serviceMap, template) {
  // サービスごとに order 昇順でグループ化し、同カテゴリ内の関連作品・前後の案件を求める。
  const byService = new Map();
  for (const w of works) {
    const sid = w.service && w.service.id ? w.service.id : "__none__";
    if (!byService.has(sid)) byService.set(sid, []);
    byService.get(sid).push(w);
  }
  for (const list of byService.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  for (const work of works) {
    const sid = work.service && work.service.id ? work.service.id : "__none__";
    const sameCategory = byService.get(sid) || [];
    const selfIndex = sameCategory.findIndex((w) => w.id === work.id);
    const prevWork = selfIndex > 0 ? sameCategory[selfIndex - 1] : null;
    const nextWork = selfIndex >= 0 && selfIndex < sameCategory.length - 1 ? sameCategory[selfIndex + 1] : null;
    const related = sameCategory.filter((w) => w.id !== work.id).slice(0, 3);

    const gallery = Array.isArray(work.gallery) ? work.gallery : [];
    const galleryHtml = gallery.map((item, i) => renderGalleryItem(item, i)).join("\n");

    const service = work.service && serviceMap.has(work.service.id) ? serviceMap.get(work.service.id) : null;
    const categoryLabel = service ? service.title : "";

    // OGP用は 1200x630 に切り出す。サムネイル未設定なら共通のOGP画像を使う。
    const ogImage = cropImage(work.thumbnail, 1200, 630) || DEFAULT_OG_IMAGE;
    const relPath = `works/${work.id}.html`;

    // 案件の説明文が未入力でも description が空にならないよう、
    // カテゴリ・年・クライアントから組み立てた文にフォールバックする。
    const fallbackParts = [work.title];
    if (categoryLabel) fallbackParts.push(`${categoryLabel}の実績`);
    if (work.client) fallbackParts.push(work.client);
    if (work.year) fallbackParts.push(`${work.year}年`);
    const description = buildDescription(
      work.description,
      `${fallbackParts.join("｜")}｜株式会社Tether Lightの撮影実績です。`
    );

    const prevLink = renderPagerLink(prevWork, "前の案件", "work-pager__link--prev");
    const nextLink = renderPagerLink(nextWork, "次の案件", "work-pager__link--next");

    const html = render(template, {
      head: renderHead({
        // ご指定の「案件名 | 実績 | 株式会社Tether Light」の形式にする
        title: `${work.title} | 実績`,
        description,
        path: relPath,
        ogType: "article",
        ogImage,
      }),
      title: escapeHtml(work.title),
      serviceId: sid === "__none__" ? "" : sid,
      metaBlock: renderMetaBlock({ categoryLabel, client: work.client, year: work.year }),
      descriptionBlock: renderDescriptionBlock(work.description),
      videoBlock: renderVideoBlock(work.videoUrl),
      galleryBlock: renderGalleryBlock(galleryHtml),
      relatedHtml: renderRelated(related),
      pagerBlock: renderPagerBlock(prevLink, nextLink),
    });

    await writeFile(path.join(DIST, "works", `${work.id}.html`), html, "utf-8");
  }
}

// エンドポイントが未作成（404）の場合は0件として扱い、ビルドを止めない。
// 「services/worksが0件なら実績への導線を出さない」という仕様と地続きの挙動にするため。
async function fetchContentsOrEmpty(endpoint, options) {
  try {
    return await fetchAllContents(endpoint, options);
  } catch (err) {
    if (String(err.message).includes("404")) {
      console.warn(`[build-works] "${endpoint}" エンドポイントが見つかりません（未作成の可能性）。0件として扱います。`);
      return [];
    }
    throw err;
  }
}

export async function buildWorks() {
  console.log("[build-works] microCMSからservices/worksを取得しています…");
  const services = await fetchContentsOrEmpty("services", { orders: "order" });
  const works = await fetchContentsOrEmpty("works", { orders: "order" });
  console.log(`[build-works] services: ${services.length}件 / works: ${works.length}件`);

  const serviceMap = new Map(services.map((s) => [s.id, s]));

  await patchTopPage(services, works);
  await buildWorksList(services, works);

  const detailTemplate = await readFile(path.join(ROOT, "templates", "works-detail.html"), "utf-8");
  await buildWorksDetail(works, serviceMap, detailTemplate);

  // トップページ・ニュース・実績の全ページを対象に、「実績」ナビの表示/非表示を統一する。
  await patchWorksNavEverywhere(works);

  console.log("[build-works] 完了しました。");

  // sitemap.xml の lastmod に使う更新日を返す
  return new Map(
    works.map((w) => [`works/${w.id}.html`, String(w.updatedAt || w.publishedAt).slice(0, 10)])
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  buildWorks().catch((err) => {
    console.error("[build-works] エラー:", err);
    process.exit(1);
  });
}
