#!/usr/bin/env python3
"""Generate PWA icons (PNG) from the brand favicon SVG.

Outputs:
  public/icons/icon-192.png
  public/icons/icon-512.png
  public/icons/maskable-192.png  (with padding for maskable safe area)
  public/icons/apple-touch-icon.png (180x180)
  public/og-image.png (1200x630, branded)
"""
import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont

PUBLIC_DIR = '/home/z/my-project/crypto-exchange/frontend/public'
ICONS_DIR = os.path.join(PUBLIC_DIR, 'icons')
os.makedirs(ICONS_DIR, exist_ok=True)

SVG_PATH = os.path.join(PUBLIC_DIR, 'favicon.svg')

# Expanded SVG with better proportions for large icons
BRAND_SVG_TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5b544"/>
      <stop offset="100%" stop-color="#f43f7a"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0e1f"/>
      <stop offset="100%" stop-color="#050813"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="{radius}" fill="url(#bg)"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".05em"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="900" font-size="320" fill="#050813">N</text>
</svg>
"""

# Standard icons (squircle-style rounded)
def render_svg(svg_str, out_path, size):
    cairosvg.svg2png(
        bytestring=svg_str.encode('utf-8'),
        write_to=out_path,
        output_width=size,
        output_height=size
    )
    print(f'  ✓ {out_path}  ({size}x{size})')

# 1. Standard icon (squircle radius ~22%)
standard_svg = BRAND_SVG_TEMPLATE.format(radius=512 * 0.22)
render_svg(standard_svg, os.path.join(ICONS_DIR, 'icon-512.png'), 512)
render_svg(standard_svg, os.path.join(ICONS_DIR, 'icon-192.png'), 192)
render_svg(standard_svg, os.path.join(ICONS_DIR, 'apple-touch-icon.png'), 180)

# 2. Maskable variant — full bleed background with safe area padding (~20%)
# The "N" needs to be smaller and centered to fit within the 80% safe area
MASKABLE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5b544"/>
      <stop offset="100%" stop-color="#f43f7a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".08em"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="900" font-size="240" fill="#050813">N</text>
</svg>
"""
render_svg(MASKABLE_SVG, os.path.join(ICONS_DIR, 'maskable-512.png'), 512)
render_svg(MASKABLE_SVG, os.path.join(ICONS_DIR, 'maskable-192.png'), 192)

# 3. Favicon 32x32 + 16x16 (PNG fallback alongside SVG)
SMALL_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5b544"/>
      <stop offset="100%" stop-color="#f43f7a"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em"
        font-family="system-ui, sans-serif" font-weight="900" font-size="18" fill="#050813">N</text>
</svg>
"""
render_svg(SMALL_SVG, os.path.join(PUBLIC_DIR, 'favicon-32.png'), 32)
render_svg(SMALL_SVG, os.path.join(PUBLIC_DIR, 'favicon-16.png'), 16)

# 4. OG Image — 1200x630 branded social preview
OG_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050813"/>
      <stop offset="50%" stop-color="#0a0e1f"/>
      <stop offset="100%" stop-color="#10152a"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5b544"/>
      <stop offset="100%" stop-color="#f43f7a"/>
    </linearGradient>
    <linearGradient id="gold-text" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f5b544"/>
      <stop offset="100%" stop-color="#f43f7a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="60%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Grid pattern -->
  <g opacity="0.05" stroke="#f5b544" stroke-width="1">
    <line x1="0" y1="100" x2="1200" y2="100"/>
    <line x1="0" y1="200" x2="1200" y2="200"/>
    <line x1="0" y1="300" x2="1200" y2="300"/>
    <line x1="0" y1="400" x2="1200" y2="400"/>
    <line x1="0" y1="500" x2="1200" y2="500"/>
    <line x1="200" y1="0" x2="200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="1000" y1="0" x2="1000" y2="630"/>
  </g>

  <!-- Brand badge top -->
  <g transform="translate(600, 90)">
    <rect x="-90" y="-32" width="180" height="64" rx="32" fill="#f5b544" fill-opacity="0.08" stroke="#f5b544" stroke-opacity="0.2"/>
    <circle cx="-50" cy="0" r="6" fill="#22d3a4"/>
    <text x="-30" y="6" font-family="system-ui" font-size="18" font-weight="500" fill="#f5b544">منصة الشرق الأوسط #1</text>
  </g>

  <!-- Logo N -->
  <g transform="translate(600, 230)">
    <rect x="-50" y="-50" width="100" height="100" rx="24" fill="url(#brand)"/>
    <text x="0" y="14" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="64" fill="#050813">N</text>
  </g>

  <!-- Title -->
  <text x="600" y="360" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="80" fill="#ffffff">NEXUS Exchange</text>

  <!-- Subtitle -->
  <text x="600" y="430" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="400" fill="#94a3b8">منصة تداول العملات الرقمية الاحترافية</text>

  <!-- Stats row -->
  <g transform="translate(600, 510)">
    <g transform="translate(-300, 0)">
      <text x="0" y="0" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="36" fill="url(#gold-text)">+2M</text>
      <text x="0" y="30" text-anchor="middle" font-family="system-ui" font-size="16" fill="#64748b">متداول نشط</text>
    </g>
    <g transform="translate(0, 0)">
      <text x="0" y="0" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="36" fill="url(#gold-text)">$50B</text>
      <text x="0" y="30" text-anchor="middle" font-family="system-ui" font-size="16" fill="#64748b">حجم يومي</text>
    </g>
    <g transform="translate(300, 0)">
      <text x="0" y="0" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="36" fill="url(#gold-text)">99.99%</text>
      <text x="0" y="30" text-anchor="middle" font-family="system-ui" font-size="16" fill="#64748b">وقت تشغيل</text>
    </g>
  </g>
</svg>
"""
render_svg(OG_SVG, os.path.join(PUBLIC_DIR, 'og-image.png'), 1200)
# cairosvg uses width param; let's ensure OG is exactly 1200x630
og_path = os.path.join(PUBLIC_DIR, 'og-image.png')
# Re-render with explicit dimensions
cairosvg.svg2png(
    bytestring=OG_SVG.encode('utf-8'),
    write_to=og_path,
    output_width=1200,
    output_height=630
)
print(f'  ✓ {og_path}  (1200x630)')

print('\nAll icons generated successfully.')
