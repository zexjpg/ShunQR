"""生成 Edge Add-ons 商店素材：300x300 商店 logo + 440x280 推广图（纯标准库，无依赖）。

用法： python tools/make-store-assets.py store/assets
"""
import os
import struct
import sys
import zlib

BLUE = (65, 105, 225)
WHITE = (255, 255, 255)

# 以 128x128 为设计坐标系
FINDERS = [(18, 18), (80, 18), (18, 80)]
BLOCKS = [(82, 82, 12, 12), (100, 82, 10, 12), (82, 100, 12, 10), (100, 100, 10, 10), (52, 52, 8, 8)]


def in_rect(x, y, ox, oy, w, h):
    return ox <= x <= ox + w and oy <= y <= oy + h


def in_rrect(x, y, ox, oy, w, h, r):
    if x < ox or y < oy or x > ox + w or y > oy + h:
        return False
    cx = min(max(x, ox + r), ox + w - r)
    cy = min(max(y, oy + r), oy + h - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_frame(x, y, ox, oy, size, thick):
    return in_rect(x, y, ox, oy, size, size) and not in_rect(
        x, y, ox + thick, oy + thick, size - 2 * thick, size - 2 * thick
    )


def glyph(x, y):
    """128 坐标系下的二维码图案覆盖判断。"""
    for ox, oy in FINDERS:
        if in_frame(x, y, ox, oy, 30, 7):
            return True
        if in_rect(x, y, ox + 10, oy + 10, 10, 10):
            return True
    for bx, by, bw, bh in BLOCKS:
        if in_rect(x, y, bx, by, bw, bh):
            return True
    return False


def blend(base, color, alpha):
    if alpha <= 0:
        return base
    if alpha >= 1:
        return color
    return tuple(int(round(base[i] * (1 - alpha) + color[i] * alpha)) for i in range(3))


def png_bytes(width, height, rows):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )


# ---------- 1. 商店 logo：300x300，蓝底圆角 + 白色二维码 ----------


def build_logo(size, ss=4):
    scale = 128.0 / size
    rows = []
    for py in range(size):
        row = bytearray(b"\x00")
        for px in range(size):
            bg = 0.0
            fg = 0.0
            for i in range(ss):
                for j in range(ss):
                    x = (px + (i + 0.5) / ss) * scale
                    y = (py + (j + 0.5) / ss) * scale
                    if in_rrect(x, y, 0, 0, 128, 128, 28):
                        bg += 1
                        if glyph(x, y):
                            fg += 1
            total = ss * ss
            bg_cov = bg / total
            if bg_cov <= 0:
                row.extend((0, 0, 0, 0))
                continue
            fg_cov = (fg / bg) if bg else 0.0
            color = blend(BLUE, WHITE, fg_cov)
            row.extend((color[0], color[1], color[2], int(round(bg_cov * 255))))
        rows.append(bytes(row))
    return png_bytes(size, size, rows)


# ---------- 2. 推广图：440x280，渐变底 + 白卡片 + 二维码 ----------


def build_promo(width=440, height=280, ss=3):
    card = 168.0
    cx = (width - card) / 2.0
    cy = (height - card) / 2.0
    inset = (card - 128.0) / 2.0
    radius = 34.0
    shadow_dy = 7.0

    top = (242, 250, 255)
    bottom = (214, 228, 255)

    rows = []
    total = ss * ss
    for py in range(height):
        row = bytearray(b"\x00")
        for px in range(width):
            # 背景渐变
            t = (px / float(width) + py / float(height)) / 2.0
            base = tuple(top[k] + (bottom[k] - top[k]) * t for k in range(3))

            shadow = 0.0
            plate = 0.0
            ink = 0.0
            for i in range(ss):
                for j in range(ss):
                    x = px + (i + 0.5) / ss
                    y = py + (j + 0.5) / ss
                    if in_rrect(x, y, cx, cy + shadow_dy, card, card, radius + 2):
                        shadow += 1
                    if in_rrect(x, y, cx, cy, card, card, radius):
                        plate += 1
                        gx = (x - cx - inset) / 1.0
                        gy = (y - cy - inset) / 1.0
                        if 0 <= gx <= 128 and 0 <= gy <= 128 and glyph(gx, gy):
                            ink += 1
            color = blend(base, (12, 26, 60), 0.10 * shadow / total)
            color = blend(color, WHITE, plate / total)
            if plate > 0:
                color = blend(color, BLUE, ink / plate)
            row.extend((int(color[0]), int(color[1]), int(color[2]), 255))
        rows.append(bytes(row))
    return png_bytes(width, height, rows)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "store/assets"
    os.makedirs(out_dir, exist_ok=True)

    logo = os.path.join(out_dir, "logo-300.png")
    with open(logo, "wb") as fh:
        fh.write(build_logo(300))
    print("wrote", logo, os.path.getsize(logo), "bytes")

    promo = os.path.join(out_dir, "promo-440x280.png")
    with open(promo, "wb") as fh:
        fh.write(build_promo())
    print("wrote", promo, os.path.getsize(promo), "bytes")


main()
