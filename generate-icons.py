#!/usr/bin/env python3
"""Generate PawPlan PWA icons — Organic style"""

import struct, zlib, math, os

def lerp(a, b, t): return a + (b - a) * t
def clamp(v, lo, hi): return max(lo, min(hi, v))

def sdf_ellipse(px, py, cx, cy, rx, ry, angle=0):
    cos_a = math.cos(angle); sin_a = math.sin(angle)
    dx = px - cx; dy = py - cy
    xr = dx*cos_a + dy*sin_a; yr = -dx*sin_a + dy*cos_a
    return math.sqrt((xr/rx)**2 + (yr/ry)**2) - 1.0

def in_rounded_rect(x, y, cx, cy, w, h, r):
    l, ri, t, b = cx-w/2+r, cx+w/2-r, cy-h/2+r, cy+h/2-r
    if l<=x<=ri and cy-h/2<=y<=cy+h/2: return True
    if cx-w/2<=x<=cx+w/2 and t<=y<=b: return True
    for (cx2,cy2) in [(l,t),(ri,t),(l,b),(ri,b)]:
        if (x-cx2)**2+(y-cy2)**2<=r**2: return True
    return False

def create_icon(size):
    s = size; f = s/512.0
    cx = cy = s/2.0

    # Organic palette
    bg_top    = (78, 122, 99)   # #4E7A63
    bg_bot    = (46,  74, 58)   # #2E4A3A
    cream_top = (251,248,243)   # #FBF8F3
    cream_bot = (232,224,212)   # #E8E0D4
    terra     = (196,113, 74)   # #C4714A

    # Paw geometry
    pad_cx, pad_cy = cx, cy + 28*f
    pad_rx, pad_ry = 92*f, 78*f
    tr_x, tr_y = 33*f, 40*f
    toes = [
        (cx-96*f,  cy-52*f, -0.26),
        (cx-37*f,  cy-92*f, -0.09),
        (cx+37*f,  cy-92*f,  0.09),
        (cx+96*f,  cy-52*f,  0.26),
    ]
    aa = max(1.8, 1.8*f)
    pixels = []

    for y in range(s):
        row = []
        for x in range(s):
            # Rounded square background
            card_r = s * 0.27   # generous rounding for organic feel
            on_card = in_rounded_rect(x, y, cx, cy, s*0.92, s*0.92, card_r)

            # Radial-ish gradient: lighter top-left, darker bottom-right
            tx = clamp((x/s)*0.35 + (y/s)*0.45, 0, 1)
            bgr = int(lerp(bg_top[0], bg_bot[0], tx))
            bgg = int(lerp(bg_top[1], bg_bot[1], tx))
            bgb = int(lerp(bg_top[2], bg_bot[2], tx))

            if not on_card:
                row.extend([bgr, bgg, bgb, 255]); continue

            # Paw SDF
            d_main = sdf_ellipse(x, y, pad_cx, pad_cy, pad_rx, pad_ry)
            d_toe  = min(sdf_ellipse(x, y, tx2, ty, tr_x, tr_y, ang) for (tx2,ty,ang) in toes)
            d_paw  = min(d_main, d_toe)

            alpha = clamp(1.0 - d_paw/aa, 0.0, 1.0) if d_paw > -aa else (1.0 if d_paw <= 0 else 0.0)

            # Cream gradient on paw
            pt = clamp((y/s - 0.2) * 1.8, 0, 1)
            cr = int(lerp(cream_top[0], cream_bot[0], pt))
            cg = int(lerp(cream_top[1], cream_bot[1], pt))
            cb = int(lerp(cream_top[2], cream_bot[2], pt))

            # Terracotta centre dot (on main pad only)
            d_dot = sdf_ellipse(x, y, pad_cx, pad_cy, 22*f, 18*f)
            dot_alpha = clamp(1.0 - d_dot/aa, 0.0, 1.0) if d_dot > -aa else (1.0 if d_dot <= 0 else 0.0)
            dot_alpha *= 0.38  # subtle

            if alpha > 0:
                pr = int(lerp(bgr, lerp(cr, terra[0], dot_alpha), alpha))
                pg = int(lerp(bgg, lerp(cg, terra[1], dot_alpha), alpha))
                pb = int(lerp(bgb, lerp(cb, terra[2], dot_alpha), alpha))
                row.extend([pr, pg, pb, 255])
            else:
                row.extend([bgr, bgg, bgb, 255])
        pixels.append(row)

    def chunk(name, data):
        crc = zlib.crc32(name+data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)

    raw = b''.join(b'\x00' + bytes(r) for r in pixels)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', s, s, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 6))
            + chunk(b'IEND', b''))

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#4E7A63"/>
      <stop offset="100%" stop-color="#2E4A3A"/>
    </radialGradient>
    <linearGradient id="paw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBF8F3"/>
      <stop offset="100%" stop-color="#E8E0D4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="138" fill="url(#bg)"/>
  <rect width="512" height="512" rx="138" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
  <ellipse cx="256" cy="284" rx="92" ry="78" fill="url(#paw)"/>
  <ellipse cx="154" cy="192" rx="33" ry="40" transform="rotate(-15,154,192)" fill="url(#paw)"/>
  <ellipse cx="209" cy="152" rx="31" ry="38" transform="rotate(-5,209,152)" fill="url(#paw)"/>
  <ellipse cx="303" cy="152" rx="31" ry="38" transform="rotate(5,303,152)" fill="url(#paw)"/>
  <ellipse cx="358" cy="192" rx="33" ry="40" transform="rotate(15,358,192)" fill="url(#paw)"/>
  <ellipse cx="256" cy="284" rx="22" ry="18" fill="rgba(196,113,74,0.38)"/>
</svg>'''

os.makedirs('assets', exist_ok=True)

for size, name in [(192,'icon-192.png'), (512,'icon-512.png')]:
    with open(f'assets/{name}', 'wb') as f: f.write(create_icon(size))
    print(f'✓  assets/{name}')

with open('assets/logo.svg', 'w') as f: f.write(SVG)
print('✓  assets/logo.svg')
print('\nDone! 🐾')
