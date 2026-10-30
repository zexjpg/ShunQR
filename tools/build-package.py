"""把扩展目录打成可直接上传 Edge Add-ons 的 .zip（只含运行时文件）。

用法： python tools/build-package.py
输出： dist/顺手码-<version>.zip
"""
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# 只打这些路径（目录递归）
INCLUDE_FILES = [
    "manifest.json",
    "background.js",
    "offscreen.html",
    "offscreen.js",
    "panel.html",
    "panel.js",
    "content/scan.js",
    "gen/render.js",
    "gen/payload.js",
    "gen/ui.js",
]
INCLUDE_DIRS = [
    "icons",
    os.path.join("vendor", "zxing"),
    os.path.join("vendor", "qrcode"),
]

# 只在本地开发时存在，不进安装包
EXCLUDE = {
    "vendor/zxing/package.json",
}


def collect():
    files = []
    for rel in INCLUDE_FILES:
        path = os.path.join(ROOT, rel)
        if not os.path.isfile(path):
            sys.exit("缺少文件: " + rel)
        files.append(rel)

    for rel_dir in INCLUDE_DIRS:
        base = os.path.join(ROOT, rel_dir)
        if not os.path.isdir(base):
            sys.exit("缺少目录: " + rel_dir)
        for cur, _dirs, names in os.walk(base):
            for name in sorted(names):
                full = os.path.join(cur, name)
                rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                if rel in EXCLUDE:
                    continue
                files.append(rel)
    return files


def main():
    manifest = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))
    version = manifest["version"]
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "顺手码-%s.zip" % version)
    if os.path.exists(out):
        os.remove(out)

    files = collect()
    total = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel in files:
            full = os.path.join(ROOT, rel)
            total += os.path.getsize(full)
            zf.write(full, rel)

    print("version :", version)
    print("files   :", len(files))
    print("raw     : %.1f KB" % (total / 1024.0))
    print("zip     : %.1f KB" % (os.path.getsize(out) / 1024.0))
    print("output  :", out)
    print("--- 包内清单 ---")
    for rel in files:
        print(" ", rel)


main()
