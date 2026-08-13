// ビルド全体のエントリーポイント。
// News → Works → SEO → Sitemap の順で実行する。
//   - Works は News が作った dist/ に追記するため、この順序が必要
//   - SEO は静的ページのheadを差し替えるだけなので、コピー後であればよい
//   - Sitemap は dist/ を走査して作るため、全ページの生成後に実行する

import { buildNews } from "./build-news.mjs";
import { buildWorks } from "./build-works.mjs";
import { buildSeo } from "./build-seo.mjs";
import { buildSitemap } from "./build-sitemap.mjs";

async function main() {
  const newsLastmod = await buildNews();
  const worksLastmod = await buildWorks();
  await buildSeo();
  // 詳細ページの更新日はmicroCMS由来のものを使い、それ以外はビルド日にする
  await buildSitemap(new Map([...newsLastmod, ...worksLastmod]));
}

main().catch((err) => {
  console.error("[build] エラー:", err);
  process.exit(1);
});
