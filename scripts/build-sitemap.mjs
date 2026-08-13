// dist/ を走査して sitemap.xml と robots.txt を生成する。
// ページ一覧をハードコードせず実際の出力から作るため、
// ニュースのページ送り（news/page/2.html）や記事の増減に自動で追随する。

import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { absoluteUrl, SITE_URL } from "./lib/seo.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/** 検索結果に載せないページ。build-seo 側の noindex 指定と対応させる。 */
const EXCLUDED = new Set(["thanks.html"]);

/** トップに近いページほど優先度を高くする。 */
function priorityFor(relPath) {
  if (relPath === "index.html") return "1.0";
  if (relPath === "news/index.html" || relPath === "works/index.html") return "0.8";
  if (relPath === "contact.html") return "0.8";
  return "0.6";
}

async function listHtmlFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

/**
 * @param {Map<string, string>} lastmodByPath
 *   詳細ページの更新日（microCMSの updatedAt）。キーは "news/xxxx.html" 形式。
 */
export async function buildSitemap(lastmodByPath = new Map()) {
  console.log("[build-sitemap] sitemap.xml / robots.txt を生成しています…");

  const buildDate = new Date().toISOString().slice(0, 10);

  const files = (await listHtmlFiles(DIST))
    .map((abs) => path.relative(DIST, abs).split(path.sep).join("/"))
    .filter((rel) => !EXCLUDED.has(rel))
    .sort();

  const urls = files.map((rel) => {
    const lastmod = lastmodByPath.get(rel) || buildDate;
    return `  <url>
    <loc>${absoluteUrl(rel)}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priorityFor(rel)}</priority>
  </url>`;
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
  await writeFile(path.join(DIST, "sitemap.xml"), sitemap, "utf-8");

  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  await writeFile(path.join(DIST, "robots.txt"), robots, "utf-8");

  console.log(`[build-sitemap] ${files.length}ページを sitemap.xml に登録しました。`);
}
