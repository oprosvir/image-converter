# Local Image Converter

A fast, private, and lightweight 100% client-side image converter and PDF merger. Convert photos, graphics, Apple HEIC, and scan documents directly in your browser without uploading files to any server.

🚀 **Live Web App**: [https://oprosvir.github.io/image-converter/](https://oprosvir.github.io/image-converter/)

---

<img src="https://github.com/user-attachments/assets/41e899c2-3c0e-4897-8bbb-7e48e1ed7ee6" alt="Local Image Converter Preview" width="800">

---

## Supported Formats

| Format | Mode | Recommended Use |
| :--- | :--- | :--- |
| **WebP** | In / Out | Websites, blogs, and online stores: loads 2–3× faster than JPEG with identical visual quality |
| **JPG / JPEG** | In / Out | Everyday photo sharing and printing: universal compatibility across every device, OS, and service |
| **PNG** | In / Out | Logos, UI screenshots, and graphics requiring transparent backgrounds and sharp text |
| **ICO** | In / Out | Website browser tab icons (`favicon.ico`) and Windows desktop shortcut icons (bundle of 16 to 256 px) |
| **AVIF** | In / Out | Next-gen AV1 web publishing: extreme file size savings for bandwidth-conscious applications |
| **BMP** | In / Out | Uncompressed 24-bit raw bitmap data for legacy software, CNC tooling, and industrial or medical systems |
| **JFIF** | In / Out | Standard JPEG exchange variant often saved from browsers: converts into regular JPG or WebP for seamless editing |
| **PDF** | Export only | Documents and scans: merging multiple receipts, contracts, or report photos into a single printable A4 file |
| **Apple HEIC / HEIF** | Import only | iPhone & iPad camera photos: converting to universal JPEG/PNG to open on Windows, Android, or web portals |
| **SVG** | Import only | Vector icons and brand logos: rasterizing into crisp, high-resolution PNG or JPG for apps that do not accept vector files |
| **GIF** | Import only | Legacy animations and web clips: converting heavy GIF files into modern, lightweight WebP or PNG images |

---

## Technical Overview

Unlike conventional online image converters that upload files to cloud servers, **Local Image Converter** runs 100% locally within your browser sandbox. All decoding, processing, compression, and encoding operations execute strictly in client RAM.

```text
[Input File] (JPG, PNG, HEIC, etc.)
       │
       ▼
[Decoder Layer] ──► HTML5 Native Image Decoder OR WebAssembly libheif Engine
       │
       ▼
[Canvas 2D Pipeline] ──► RAM-Only Pixel Processing & Automatic EXIF/GPS Stripping
       │
       ▼
[Encoder Layer] ──► Native Canvas toBlob() OR Custom Binary Encoders (ICO, BMP)
       │
       ▼
[Output Memory Blob] ──► Direct Download / Multi-page PDF / In-Memory ZIP Archive
```

### 1. WebAssembly (Wasm) Apple HEIC/HEIF Decoder
Modern iPhones capture photos in high-efficiency HEIC/HEIF containers, which most web browsers cannot natively decode.
* We bundle an offline, sandboxed **WebAssembly (Wasm)** compilation of `libheif` (`heic2any.min.js`).
* The WebAssembly module decodes proprietary Apple HEIC files directly in browser memory at near-native C/C++ execution speeds, converting them into standard pixel arrays without any external server or API.

### 2. Privacy-by-Design: Automatic EXIF & Metadata Stripping
Photos captured on smartphones and cameras embed sensitive EXIF metadata by default:
* **Precise GPS Coordinates**: exact latitude, longitude, and altitude of the photo location.
* **Device Identification**: camera model, smartphone serial numbers, software/OS versions.
* **Timestamps & Fingerprints**: exact creation timestamps and embedded thumbnail previews.

**How metadata is sanitized:**
When an image is drawn onto an HTML5 Canvas (`CanvasRenderingContext2D`) and re-encoded, the browser works exclusively with raw pixel color values. **All EXIF tags, GPS markers, device signatures, and proprietary metadata chunks are automatically and permanently stripped.** The exported files are completely sanitized and safe for public web sharing.

### 3. Native Canvas 2D Pipeline & Hardware Acceleration
* Utilizes `HTMLCanvasElement.toBlob()` and `OffscreenCanvas` with browser hardware acceleration for fast, efficient encoding of **WebP**, **AVIF**, **JPEG**, and **PNG**.
* Configured with high-quality bicubic interpolation (`imageSmoothingQuality = 'high'`) to preserve sharpness and avoid distortion during processing.

### 4. Custom Client-Side Binary Encoders
For specialized legacy formats not supported by standard browser Canvas export APIs, custom binary encoders construct the files byte-by-byte:
* **Multi-Frame ICO Encoder (`ico-encoder.js`)**: Assembles a standard Windows Icon binary containing 6 distinct icon frames (16×16, 32×32, 48×48, 64×64, 128×128, and 256×256 px) with proper directory headers and embedded PNG payloads.
* **24-Bit BMP Encoder (`bmp-encoder.js`)**: Builds uncompressed Windows DIB/BMP bitmaps with strict 4-byte scanline padding.

### 5. In-Memory Document & Archive Generation
* **Merge to PDF**: Leverages `jspdf.umd.min.js` to assemble multi-page A4 scan documents in memory without aspect ratio distortion.
* **Batch ZIP Archiving**: Packages batch conversion outputs into a `.zip` archive using `jszip.min.js`.
* **Zero Disk Footprint**: Blobs exist only in browser RAM (`blob:http://...`). When downloaded, data streams directly from memory to your download folder. Closing or refreshing the tab instantly frees all memory.

### 6. Same-Format Recompression (Image Optimizer)
Selecting the same source and target format (e.g. `JPG ➔ JPG` or `WebP ➔ WebP`) turns the application into an **in-browser image compressor and privacy cleaner**:
* Recompresses heavy camera photos (e.g., 6–10 MB) down to compact web-ready files (e.g., 500 KB–1.5 MB) using your chosen compression quality slider.
* Strips all metadata while keeping the original dimensions and file format intact.

---

## Repository Layout

```text
image-converter/
├── index.html           # Main semantic single-page application UI
├── logo.png             # Application logo & browser favicon
├── app.ico              # Multi-resolution Windows desktop shortcut icon
├── server.py            # Zero-dependency local Python HTTP launcher (Python 3 stdlib)
├── run.bat              # One-click launcher for Windows
├── run.sh               # One-click launcher for Linux and macOS
├── css/
│   └── styles.css       # Responsive dark/light theme stylesheet
└── js/
    ├── app.js           # UI controller, state management & Drag-and-Drop handling
    ├── converter.js     # Core client-side conversion & PDF generation engine
    ├── ico-encoder.js   # Client-side multi-frame ICO binary encoder
    ├── bmp-encoder.js   # Client-side 24-bit uncompressed BMP binary encoder
    └── vendor/          # Standalone offline vendor libraries:
        ├── jszip.min.js      # Client-side ZIP archive builder
        ├── jspdf.umd.min.js  # Client-side PDF generator
        └── heic2any.min.js   # WebAssembly Apple HEIC decoder
```

---

## Quick Start

### Windows
1. Double-click **`run.bat`**.
2. The application will start and automatically open in your default browser at `http://localhost:8000/`.
3. *(Alternative)*: You can also double-click **`index.html`** directly without running Python.

### Linux & macOS
1. Open terminal and run:
   ```bash
   ./run.sh
   ```
   *(Or simply run `python3 server.py`)*.
2. *(Alternative)*: Open `index.html` directly in your browser:
   ```bash
   xdg-open index.html   # Linux
   open index.html       # macOS
   ```

---

## License

This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
