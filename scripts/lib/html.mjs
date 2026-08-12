// HTML文字列を扱う小さなヘルパー群。

export function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function excerpt(html, len = 100) {
  const text = stripHtml(html);
  return text.length > len ? text.slice(0, len) + "…" : text;
}

export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
