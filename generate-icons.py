#!/usr/bin/env python3
"""Generate PawPlan PWA icons"""

import struct, zlib, os

def create_png(size, bg_color, paw_color):
    """Create a simple PNG with a paw print icon"""
    pixels = []
    cx, cy = size // 2, size // 2
    r = size // 3

    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x - cx, y - cy

            # Main pad (large oval)
            in_main = (dx/r)**2 + (dy/(r*1.1))**2 < 1

            # Four toe pads
            toe_r = r * 0.32
            toes = [
                (-r*0.65, -r*0.72),
                (-r*0.22, -r*0.92),
                ( r*0.22, -r*0.92),
                ( r*0.65, -r*0.72),
            ]
            in_toe = any((dx-tx)**2 + (dy-ty)**2 < toe_r**2 for tx, ty in toes)

            if in_main or in_toe:
                row.extend(paw_color)
            else:
                row.extend(bg_color)
        pixels.append(row)

    # Build PNG
    def png_chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)

    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)

    png = (
        b'\x89PNG\r\n\x1a\n'
        + png_chunk(b'IHDR', ihdr)
        + png_chunk(b'IDAT', compressed)
        + png_chunk(b'IEND', b'')
    )
    return png

os.makedirs('assets', exist_ok=True)

bg  = [61, 90, 76, 255]   # --forest
paw = [250, 247, 242, 255] # --cream

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    with open(f'assets/{name}', 'wb') as f:
        f.write(create_png(size, bg, paw))
    print(f'Created assets/{name}')

print('Icons generated!')
