# Store listing (English)

> Language code: en-US. Fill this into "Store listings → English" in Partner Center.
> Note: the extension **name and short description come from manifest.json and are read-only**. The English listing will still display the Chinese name 顺手码. If you want an English name, change `manifest.name` to something like `顺手码 QR Snap` and rebuild the package.

## Short description (from manifest, read-only)

Spot a QR code on a web page, frame it and decode it on the spot — copy the result, batch scan, export. The side panel also generates codes locally, with no network and nothing written to disk.

## Detailed description (required, 250–10000 characters)

QR Snap is a QR code scanner that runs entirely on your own computer. When you see a QR code on screen, click the toolbar icon to open the side panel, click "截图扫码" (Screenshot scan), then drag a rectangle over the code — the decoded content appears in the panel immediately. No screenshot files to save, no images to upload, no third-party website involved.

**What it does**

- **Select and decode**: drag over any QR code on any page. If one selection contains several codes, all of them are returned.
- **Continuous scan mode**: after each code the overlay returns to selection state and results accumulate in one list — built for processing tickets, product labels and business cards in batches.
- **History**: every entry keeps the time, barcode format and source page. The source is a clickable link back to the page it came from. Search, copy, delete, and duplicate detection that counts repeats instead of filling the list.
- **Export**: CSV, TSV and JSON. CSV includes a BOM so Excel opens it without garbled characters, and TSV can be pasted straight into a spreadsheet.
- **Right-click an image**: the top-level context menu offers "扫描这张图片里的二维码" (scan this image), which decodes the original image file instead of a screen capture — noticeably more reliable. When the original cannot be fetched (hotlink protection, cross-origin), it falls back to capturing the image's own area on the page.
- **Paste or drop an image**: on browser-internal pages and the extension store, where scripts cannot be injected, you can still paste or drop a QR image into the panel.
- **Optional shortcut**: no key combination is bound by default. Assign one to "截图扫码" on the browser's shortcuts page (for example Alt+Shift+Q) if you want keyboard access, so it never collides with an IME or another extension.
- **Generate codes too**: switch the panel to "Generate" and turn text, a URL, a contact card or WiFi details into a QR code. Adjust size, error correction and colors, then export PNG or SVG or copy the image. The content you type lives only in the panel's memory — it is never written to history or to disk, and it disappears when the panel closes.

**Privacy**

All decoding happens locally on your machine. The extension makes no network requests, uploads nothing and collects no analytics. History is stored only in local extension storage and can be cleared at any time.
Generated codes are computed locally as well. Their content is never stored, never added to history and never counted; closing the panel drops it from memory.

**Under the hood**

The decoder is ZXing compiled to WebAssembly and bundled inside the package — no remote code is downloaded or executed. It supports QR Code, Data Matrix, Aztec, PDF417 and common 1D barcode formats. When a first attempt fails, the decoder retries with upscaling, alternative binarization thresholds and inverted colors to improve results on small or dark-background codes.
Generation uses a pure-JavaScript QR encoder (MIT licensed, bundled). Input is encoded as UTF-8 so Chinese text and emoji survive, and every output keeps a four-module quiet zone so printed codes still scan.

## Search terms (max 7, each 30 characters or fewer)

```
qr code
qr scanner
scan qr
barcode reader
qr reader
screenshot qr
offline qr
```
