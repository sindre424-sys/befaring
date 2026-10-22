#!/usr/bin/env python3
"""Lager app-ikonene (PNG) uten eksterne biblioteker. Kjør: python3 tools/lag-ikoner.py"""
import math, os, struct, zlib

BG = (22, 32, 42)
FJELL = (122, 146, 168)
FJELL2 = (92, 114, 136)
HULL = (8, 12, 16)
VEI = (255, 196, 0)

def inni_polygon(x, y, pts):
    inn = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inn = not inn
        j = i
    return inn

def farge(x, y):
    # x, y i 0..1
    if 0.80 <= y <= 0.86 and 0.08 <= x <= 0.92:
        return VEI
    # tunnelåpning (hestesko)
    cx, cy, r = 0.5, 0.58, 0.15
    if (cx - r <= x <= cx + r and cy <= y <= 0.80) or ((x - cx) ** 2 + (y - cy) ** 2 <= r * r and y <= cy):
        return HULL
    if inni_polygon(x, y, [(0.06, 0.80), (0.36, 0.26), (0.46, 0.34), (0.62, 0.16), (0.94, 0.80)]):
        return FJELL if y > 0.45 or x < 0.55 else FJELL2
    return BG

def lag(storrelse, sti):
    ss = 4
    rader = []
    for py in range(storrelse):
        rad = bytearray([0])
        for px in range(storrelse):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = farge((px + (sx + 0.5) / ss) / storrelse, (py + (sy + 0.5) / ss) / storrelse)
                    r += c[0]; g += c[1]; b += c[2]
            n = ss * ss
            rad += bytes((r // n, g // n, b // n))
        rader.append(bytes(rad))
    raw = b''.join(rader)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', storrelse, storrelse, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(sti, 'wb') as f:
        f.write(png)

mappe = os.path.join(os.path.dirname(__file__), '..', 'icons')
for s in (180, 192, 512):
    lag(s, os.path.join(mappe, f'icon-{s}.png'))
print('Ikoner laget.')
