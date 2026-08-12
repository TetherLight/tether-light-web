// microCMSのAPIを呼び出すための共通処理。
// news・works・services のビルドスクリプトから共有で使う。

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }
  return value;
}

export function getServiceDomain() {
  return requireEnv("MICROCMS_SERVICE_DOMAIN");
}

export function getApiKey() {
  return requireEnv("MICROCMS_API_KEY");
}

export function getSiteUrl() {
  return (process.env.SITE_URL || "https://example.github.io/repo").replace(/\/+$/, "");
}

/**
 * microCMSのリスト形式APIから全件を取得する。
 * 1回のリクエストで取得できる件数（limit）に上限があるため、
 * offsetを進めながらtotalCountに達するまで繰り返し取得する。
 *
 * @param {string} endpoint エンドポイント名（例: "news"）
 * @param {{ orders?: string, limit?: number }} [options]
 * @returns {Promise<any[]>}
 */
export async function fetchAllContents(endpoint, options = {}) {
  const domain = getServiceDomain();
  const apiKey = getApiKey();
  const limit = options.limit || 100;

  let offset = 0;
  let all = [];
  let totalCount = Infinity;

  while (offset < totalCount) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (options.orders) params.set("orders", options.orders);

    const url = `https://${domain}.microcms.io/api/v1/${endpoint}?${params.toString()}`;
    const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": apiKey } });

    if (!res.ok) {
      throw new Error(`microCMS APIエラー [${endpoint}]: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    all = all.concat(data.contents);
    totalCount = data.totalCount;
    offset += limit;
  }

  return all;
}
