// HTML内の <!-- BUILD:NAME:START --> ... <!-- BUILD:NAME:END --> マーカーを
// ビルド時に書き換えるための共通処理。
// マーカー自体は残したまま、その間の内容だけを置き換える
// （dist/ は毎回ソースからコピーし直すため、マーカーを消しても問題はないが、
//   既存の news 差し込み処理と挙動を揃えるため残す方式にしている）。

/**
 * 単一のマーカー（NAMEが固定・1箇所のみ想定）の内容を置き換える。
 * @param {string} html
 * @param {string} name マーカー名（例: "WORKS_NAV_HEADER"）
 * @param {string} replacement 置き換え後の内容（マーカー自体は残る）
 */
export function replaceMarker(html, name, replacement) {
  const start = `<!-- BUILD:${name}:START -->`;
  const end = `<!-- BUILD:${name}:END -->`;
  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`マーカーが見つかりません: ${name}`);
  }
  return (
    html.slice(0, startIdx) +
    start +
    replacement +
    end +
    html.slice(endIdx + end.length)
  );
}

/**
 * <!-- BUILD:{group}:{key}:START -->...<!-- BUILD:{group}:{key}:END --> の形式で、
 * key部分が異なる複数のマーカーをまとめて置き換える。
 *
 * resolve は (key, originalInnerHtml) を受け取り、置き換え後の内容を返す。
 * 「該当データが無い場合は空にする」「該当データが無い場合は元のHTMLを保持する」の
 * どちらも呼び出し側で選べるように、元の内容も渡している。
 *
 * @param {string} html
 * @param {string} group マーカーグループ名（例: "SERVICE_LINK"）
 * @param {(key: string, originalInner: string) => string} resolve
 */
export function replaceKeyedMarkers(html, group, resolve) {
  const pattern = new RegExp(
    `<!-- BUILD:${group}:(.+?):START -->([\\s\\S]*?)<!-- BUILD:${group}:\\1:END -->`,
    "g"
  );
  return html.replace(pattern, (match, key, inner) => {
    const trimmedKey = key.trim();
    const content = resolve(trimmedKey, inner);
    return `<!-- BUILD:${group}:${key}:START -->${content}<!-- BUILD:${group}:${key}:END -->`;
  });
}
