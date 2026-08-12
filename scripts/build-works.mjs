// 実績（Works）機能のビルドスクリプト。
// microCMSの "services"（事業内容）・"works"（案件）エンドポイントから全件取得し、
// 以下を静的HTMLとして生成する。
//   - dist/works/{id}.html   … 案件詳細ページ
//   - dist/works/index.html  … 実績一覧（カテゴリタブ・全案件データを埋め込み）
//   - dist/index.html の事業内容セクション … servicesの内容を差し込む
//
// このスクリプトは dist/ フォルダが既に存在すること（build-news.mjs が先に実行され、
// 静的アセットのコピーが済んでいること）を前提にしている。dist/ の作り直しは行わない。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchAllContents } from "./lib/microcms.mjs";
import { render } from "./lib/render.mjs";
import { escapeHtml, excerpt } from "./lib/html.mjs";
import { cropImage, resizeImage, youTubeEmbedUrl } from "./lib/image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SERVICES_START = "<!-- BUILD:SERVICES:START -->";
const SERVICES_END = "<!-- BUILD:SERVICES:END -->";

// ---- 事業内容セクション（トップページ）----

const SLIDESHOW_MAX_PHOTOS = 6;

// Fisher-Yatesシャッフル。ビルドごとに並び順をランダム化する。
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function renderVisualContent(service, index, worksForService) {
  const photos = shuffle(worksForService.filter((w) => w.thumbnail)).slice(0, SLIDESHOW_MAX_PHOTOS);

  if (photos.length >= 2) {
    const slides = photos
      .map((w, i) => {
        const thumb = cropImage(w.thumbnail, 800, 600);
        return `              <img src="${thumb}" alt="" class="business-item__slide${i === 0 ? " is-active" : ""}" ${i === 0 ? "" : 'loading="lazy"'}>`;
      })
      .join("\n");
    return `            <div class="business-item__visual business-item__visual--slideshow" aria-hidden="true">
${slides}
            </div>`;
  }

  const visualModifier = index % 2 === 0 ? "business-item__visual--shooting" : "business-item__visual--media";
  return `            <div class="${["business-item__visual", visualModifier].join(" ")}" aria-hidden="true">
              <span class="business-item__number">${escapeHtml(String(service.number ?? index + 1))}</span>
            </div>`;
}

function renderServiceBlock(service, index, worksForService) {
  const isReverse = index % 2 === 1;
  const tags = Array.isArray(service.tags) ? service.tags : [];

  return `        <article class="business-item${isReverse ? " business-item--reverse" : ""}" data-animate>
          <div class="business-item__media">
${renderVisualContent(service, index, worksForService)}
          </div>
          <div class="business-item__body">
            <span class="business-item__no">SERVICE ${String(index + 1).padStart(2, "0")}</span>
            <h3 class="business-item__title">${escapeHtml(service.title)}</h3>
            <p class="business-item__desc">
              ${escapeHtml(service.description || "")}
            </p>
            <ul class="business-item__tags">
${tags.map((tag) => `              <li>${escapeHtml(tag)}</li>`).join("\n")}
            </ul>
            <a href="works/index.html?service=${service.id}" class="business-item__cta">この事業の実績を見る<span class="btn__arrow">→</span></a>
          </div>
        </article>`;
}

async function patchTopPage(services, works) {
  const indexPath = path.join(DIST, "index.html");
  const html = await readFile(indexPath, "utf-8");

  const startIdx = html.indexOf(SERVICES_START);
  const endIdx = html.indexOf(SERVICES_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("index.html に Services の差し込みマーカーが見つかりません。");
  }

  const blocksHtml = services
    .map((s, i) => {
      const worksForService = works.filter((w) => w.service && w.service.id === s.id);
      return renderServiceBlock(s, i, worksForService);
    })
    .join("\n\n");

  const patched =
    html.slice(0, startIdx) +
    SERVICES_START +
    "\n" +
    blocksHtml +
    "\n\n" +
    SERVICES_END +
    html.slice(endIdx + SERVICES_END.length);

  await writeFile(indexPath, patched, "utf-8");
}

// ---- 実績一覧ページ ----

function renderTab(id, label, isActive) {
  return `      <button type="button" class="works-tabs__item${isActive ? " is-active" : ""}" data-service="${id}">${escapeHtml(label)}</button>`;
}

function renderWorkCard(work, serviceMap, eager) {
  const thumb = cropImage(work.thumbnail, 800, 600) || "../images/logo-icon-blue.png";
  const serviceId = work.service && work.service.id ? work.service.id : "";
  return `      <a href="${work.id}.html" class="work-card" data-service="${serviceId}" data-order="${work.order ?? 0}">
        <div class="work-card__thumb-wrap">
          <img src="${thumb}" alt="${escapeHtml(work.title)}" class="work-card__thumb" width="800" height="600" ${eager ? "" : 'loading="lazy"'}>
        </div>
        <p class="work-card__title">${escapeHtml(work.title)}</p>
        <div class="work-card__meta">
          <span>${escapeHtml(work.client || "")}</span>
          <span>${escapeHtml(String(work.year || ""))}</span>
        </div>
      </a>`;
}

async function buildWorksList(services, works) {
  const tabsHtml = [
    renderTab("all", "すべて", true),
    ...services.map((s) => renderTab(s.id, s.title, false)),
  ].join("\n");

  const cardsHtml = works.map((w, i) => renderWorkCard(w, null, i === 0)).join("\n");

  const template = await readFile(path.join(ROOT, "templates", "works-list.html"), "utf-8");
  const html = render(template, { tabsHtml, cardsHtml });

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
          <p class="work-card__title">${escapeHtml(w.title)}</p>
          <div class="work-card__meta">
            <span>${escapeHtml(w.client || "")}</span>
            <span>${escapeHtml(String(w.year || ""))}</span>
          </div>
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

    const ogImageObj = resizeImage(work.thumbnail, 1200);
    const ogImage = ogImageObj ? ogImageObj.url : "";

    const html = render(template, {
      pageTitle: work.title,
      title: escapeHtml(work.title),
      client: escapeHtml(work.client || ""),
      year: escapeHtml(String(work.year || "")),
      serviceId: sid === "__none__" ? "" : sid,
      categoryLabel: escapeHtml(categoryLabel),
      description: escapeHtml(work.description || "").replace(/\n/g, "<br>"),
      videoBlock: renderVideoBlock(work.videoUrl),
      galleryHtml,
      relatedHtml: renderRelated(related),
      prevLink: renderPagerLink(prevWork, "前の案件", "work-pager__link--prev"),
      nextLink: renderPagerLink(nextWork, "次の案件", "work-pager__link--next"),
      ogDescription: escapeHtml(excerpt(work.description || "", 100)),
      ogImage,
    });

    await writeFile(path.join(DIST, "works", `${work.id}.html`), html, "utf-8");
  }
}

export async function buildWorks() {
  console.log("[build-works] microCMSからservices/worksを取得しています…");
  const services = await fetchAllContents("services", { orders: "order" });
  const works = await fetchAllContents("works", { orders: "order" });
  console.log(`[build-works] services: ${services.length}件 / works: ${works.length}件`);

  const serviceMap = new Map(services.map((s) => [s.id, s]));

  await patchTopPage(services, works);
  await buildWorksList(services, works);

  const detailTemplate = await readFile(path.join(ROOT, "templates", "works-detail.html"), "utf-8");
  await buildWorksDetail(works, serviceMap, detailTemplate);

  console.log("[build-works] 完了しました。");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  buildWorks().catch((err) => {
    console.error("[build-works] エラー:", err);
    process.exit(1);
  });
}
