# ファビコンとOGP共通画像を、images/ 内のロゴから生成する。
#
# 一度実行して成果物をコミットすれば足りるため、通常のビルド（scripts/build.mjs）には
# 含めていない。GitHub Actions は Linux で動くため、このスクリプトは実行されない。
#
#   実行方法:  powershell -ExecutionPolicy Bypass -File scripts/generate-images.ps1
#
# 出力:
#   images/favicon/favicon-32.png      32x32   透過
#   images/favicon/icon-192.png        192x192 透過
#   images/favicon/icon-512.png        512x512 透過
#   images/favicon/apple-touch-icon.png 180x180 白背景（iOSは透過を黒く塗るため）
#   images/og-default.png              1200x630 ブランドカラー背景

Add-Type -AssemblyName System.Drawing

$root       = Split-Path -Parent $PSScriptRoot
$logoPath   = Join-Path $root "images\logo-icon-blue.png"
$logoWhite  = Join-Path $root "images\logo-text-white.png"
$faviconDir = Join-Path $root "images\favicon"

if (-not (Test-Path $faviconDir)) { New-Item -ItemType Directory -Path $faviconDir | Out-Null }

# ブランドカラー #649CD3
$brand = [System.Drawing.Color]::FromArgb(255, 100, 156, 211)

<#
 .SYNOPSIS
  元画像を正方形の中央に収めて出力する。
  ロゴは縦長（348x500）なので、はみ出さないよう長辺基準で縮小し余白を均等に置く。
#>
function Save-SquareIcon {
    param(
        [string] $SourcePath,
        [string] $OutPath,
        [int]    $Size,
        [object] $Background = $null,        # Color を渡すと背景色、$null なら透過
        [double] $Inset = 0.14               # 上下左右に取る余白の割合
    )

    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)

    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($null -ne $Background) {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]$Background)
        $g.FillRectangle($brush, 0, 0, $Size, $Size)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    # 余白を除いた領域に、縦横比を保って収める
    $box   = $Size * (1.0 - $Inset * 2)
    $scale = [Math]::Min($box / $src.Width, $box / $src.Height)
    $w     = [int][Math]::Round($src.Width  * $scale)
    $h     = [int][Math]::Round($src.Height * $scale)
    $x     = [int][Math]::Round(($Size - $w) / 2)
    $y     = [int][Math]::Round(($Size - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose(); $bmp.Dispose(); $src.Dispose()
    Write-Output ("  {0}  ({1}x{1})" -f (Split-Path -Leaf $OutPath), $Size)
}

Write-Output "ファビコンを生成しています…"
Save-SquareIcon -SourcePath $logoPath -OutPath (Join-Path $faviconDir "favicon-32.png")  -Size 32  -Background $null -Inset 0.06
Save-SquareIcon -SourcePath $logoPath -OutPath (Join-Path $faviconDir "icon-192.png")    -Size 192 -Background $null
Save-SquareIcon -SourcePath $logoPath -OutPath (Join-Path $faviconDir "icon-512.png")    -Size 512 -Background $null
Save-SquareIcon -SourcePath $logoPath -OutPath (Join-Path $faviconDir "apple-touch-icon.png") -Size 180 -Background ([System.Drawing.Color]::White)

# ---- OGP共通画像（1200x630）----
# ブランドカラーの背景に、白のテキストロゴを中央配置した簡易版。
Write-Output "OGP画像を生成しています…"

$ogW = 1200; $ogH = 630
$ogBmp = New-Object System.Drawing.Bitmap($ogW, $ogH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ogG   = [System.Drawing.Graphics]::FromImage($ogBmp)
$ogG.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ogG.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ogG.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 単色だと平坦なので、サイトのヒーローに合わせて斜めのグラデーションにする
$rect = New-Object System.Drawing.Rectangle(0, 0, $ogW, $ogH)
$dark = [System.Drawing.Color]::FromArgb(255, 45, 62, 110)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $dark, $brand, 20.0)
$ogG.FillRectangle($grad, $rect)
$grad.Dispose()

$logo = [System.Drawing.Image]::FromFile($logoWhite)
$targetW = [int]($ogW * 0.42)
$targetH = [int][Math]::Round($logo.Height * ($targetW / $logo.Width))
$ogG.DrawImage($logo, [int](($ogW - $targetW) / 2), [int](($ogH - $targetH) / 2), $targetW, $targetH)
$logo.Dispose()

$ogBmp.Save((Join-Path $root "images\og-default.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$ogG.Dispose(); $ogBmp.Dispose()
Write-Output "  og-default.png  (1200x630)"

Write-Output "完了しました。"
