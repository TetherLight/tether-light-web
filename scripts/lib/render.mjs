// テンプレート文字列内の {{key}} を置き換える、最小限のプレースホルダ展開処理。

/**
 * @param {string} template {{key}} を含むテンプレート文字列
 * @param {Record<string, string|number|null|undefined>} vars
 * @returns {string}
 */
export function render(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
