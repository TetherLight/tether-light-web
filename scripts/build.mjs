// ビルド全体のエントリーポイント。
// News → Works の順で実行する（Works は News が作った dist/ に追記するため順序が重要）。

import { buildNews } from "./build-news.mjs";
import { buildWorks } from "./build-works.mjs";

async function main() {
  await buildNews();
  await buildWorks();
}

main().catch((err) => {
  console.error("[build] エラー:", err);
  process.exit(1);
});
