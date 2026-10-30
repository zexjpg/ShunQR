"""把任意尺寸的截图处理成 Edge Add-ons 要求的 1280x800（等比缩放 + 留白补齐）。

用法：
  python tools/fit-screenshot.py shot1.png shot2.png ...
输出： 同目录下 <原名>-1280x800.png
"""
import os
import struct
import sys
import zlib

TARGET_W, TARGET_H = 1280, 800
PAD_COLOR = (238, 243, 251)


def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("不是 PNG: " + path)

    pos = 8
    idat = b""
    palette = None
    w = h = depth = ctype = interlace = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        tag = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if tag == b"IHDR":
            w, h, depth, ctype, _comp, _filt, interlace = struct.unpack(">IIBBBBB", body)
        elif tag == b"PLTE":
            palette = body
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        pos += 12 + length

    if depth != 8:
        raise ValueError("只支持 8 位色深，当前 %s 位：%s" % (depth, path))
    if interlace:
        raise ValueError("不支持隔行扫描的 PNG：%s" % path)

    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(ctype)
    if channels is None:
        raise ValueError("不支持的色彩类型 %s：%s" % (ctype, path))

    raw = zlib.decompress(idat)
    stride = w * channels
    out = bytearray(w * h * 3)
    prev = bytearray(stride)
    src = 0

    for y in range(h):
        filt = raw[src]
        src += 1
        line = bytearray(raw[src : src + stride])
        src += stride

        if filt == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif filt == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif filt == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif filt == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF

        prev = line
        base = y * w * 3
        for x in range(w):
            i = x * channels
            if ctype == 3:
                idx = line[i]
                r, g, b = palette[idx * 3 : idx * 3 + 3]
            elif ctype in (0, 4):
                r = g = b = line[i]
            else:
                r, g, b = line[i], line[i + 1], line[i + 2]
            j = base + x * 3
            out[j], out[j + 1], out[j + 2] = r, g, b

    return w, h, out


def write_png(path, width, height, rgb):
    def chunk(tag, payload):
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    rows = []
    stride = width * 3
    for y in range(height):
        rows.append(b"\x00" + bytes(rgb[y * stride : (y + 1) * stride]))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


def fit(src_path, dst_path):
    sw, sh, pixels = read_png(src_path)
    scale = min(TARGET_W / float(sw), TARGET_H / float(sh))
    dw, dh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    ox, oy = (TARGET_W - dw) // 2, (TARGET_H - dh) // 2

    canvas = bytearray(PAD_COLOR * (TARGET_W * TARGET_H))

    for y in range(dh):
        sy = min(sh - 1, int((y + 0.5) / scale))
        row_base = sy * sw * 3
        dst_row = (oy + y) * TARGET_W * 3
        for x in range(dw):
            sx = min(sw - 1, int((x + 0.5) / scale))
            s = row_base + sx * 3
            d = dst_row + (ox + x) * 3
            canvas[d], canvas[d + 1], canvas[d + 2] = (
                pixels[s],
                pixels[s + 1],
                pixels[s + 2],
            )

    write_png(dst_path, TARGET_W, TARGET_H, canvas)
    return sw, sh, dw, dh


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    for src in args:
        stem, _ext = os.path.splitext(src)
        dst = stem + "-1280x800.png"
        sw, sh, dw, dh = fit(src, dst)
        print("%s  %dx%d -> %dx%d 居中留白 -> %s" % (os.path.basename(src), sw, sh, dw, dh, dst))


main()
