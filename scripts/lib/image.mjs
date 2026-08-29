// microCMSの画像フィールド { url, width, height } を扱うヘルパー。
// microCMSの画像は URL に "?w=" 等のクエリパラメータを付けるだけでリサイズできる
// （画像処理ライブラリ不要）。

/**
 * 指定した幅にリサイズした画像情報を返す。
 * width/height 属性をレイアウトずれ防止のために計算して含める。
 *
 * @param {{url:string, width:number, height:number}|null|undefined} image
 * @param {number} targetWidth
 */
export function resizeImage(image, targetWidth) {
  if (!image || !image.url) return null;
  const height =
    image.width && image.height
      ? Math.round(image.height * (targetWidth / image.width))
      : Math.round(targetWidth * 0.75);
  return {
    url: `${image.url}?w=${targetWidth}`,
    width: targetWidth,
    height,
  };
}

/**
 * 一覧サムネイル用に、指定の幅・高さでクロップしたURLを返す。
 *
 * 既定の中央クロップだと、縦構図の写真を横長に切り出したときに
 * 人物の顔が見切れてしまう。microCMSの画像APIはimgixベースで
 * 顔検出に対応しているため、顔 → 情報量の多い領域 の順で位置を決める。
 * 顔が写っていない写真では entropy が使われ、それも判定できなければ中央になる。
 */
export function cropImage(image, width, height) {
  if (!image || !image.url) return null;
  return `${image.url}?w=${width}&h=${height}&fit=crop&crop=faces,entropy`;
}

/**
 * さまざまな形式のYouTube URLから埋め込み用URLを作る。
 * 該当しない場合は null を返す。
 */
export function youTubeEmbedUrl(rawUrl) {
  if (!rawUrl) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = rawUrl.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}
