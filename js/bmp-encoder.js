/**
 * Local Image Converter - BMP Encoder
 * Encodes canvas/ImageData into standard Windows 24-bit / 32-bit BMP format.
 */

class BmpEncoder {
  /**
   * Generates a .bmp Blob from a canvas element
   * @param {HTMLCanvasElement} canvas
   * @param {boolean} preserveAlpha
   * @returns {Blob}
   */
  static canvasToBmpBlob(canvas, preserveAlpha = false) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data; // RGBA uint8 array

    const bpp = preserveAlpha ? 32 : 24;
    const bytesPerPixel = bpp / 8;
    // Each row in BMP must be a multiple of 4 bytes
    const rowSize = Math.floor((bpp * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileHeaderSize = 14;
    const dibHeaderSize = 40;
    const totalFileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;

    const buffer = new ArrayBuffer(totalFileSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // --- BMP Header (14 bytes) ---
    // 'BM' identifier
    bytes[0] = 0x42; // 'B'
    bytes[1] = 0x4D; // 'M'
    view.setUint32(2, totalFileSize, true); // File size
    view.setUint16(6, 0, true);            // Reserved
    view.setUint16(8, 0, true);            // Reserved
    view.setUint32(10, fileHeaderSize + dibHeaderSize, true); // Pixel data offset

    // --- DIB Header: BITMAPINFOHEADER (40 bytes) ---
    view.setUint32(14, dibHeaderSize, true); // Header size (40)
    view.setInt32(18, width, true);          // Width
    view.setInt32(22, height, true);         // Height (positive = bottom-to-top)
    view.setUint16(26, 1, true);             // Color planes (1)
    view.setUint16(28, bpp, true);           // Bits per pixel
    view.setUint32(30, 0, true);             // Compression: BI_RGB (none)
    view.setUint32(34, pixelArraySize, true);// Image size
    view.setInt32(38, 2835, true);           // Horizontal resolution (pixels/meter) ~72 DPI
    view.setInt32(42, 2835, true);           // Vertical resolution
    view.setUint32(46, 0, true);             // Colors in palette
    view.setUint32(50, 0, true);             // Important colors

    // --- Pixel Data (Bottom-Up order) ---
    let pixelOffset = fileHeaderSize + dibHeaderSize;

    for (let y = height - 1; y >= 0; y--) {
      let rowOffset = pixelOffset + (height - 1 - y) * rowSize;
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * 4;
        const r = data[srcIndex];
        const g = data[srcIndex + 1];
        const b = data[srcIndex + 2];
        const a = data[srcIndex + 3];

        if (bpp === 24) {
          // BGR order
          bytes[rowOffset++] = b;
          bytes[rowOffset++] = g;
          bytes[rowOffset++] = r;
        } else {
          // BGRA order
          bytes[rowOffset++] = b;
          bytes[rowOffset++] = g;
          bytes[rowOffset++] = r;
          bytes[rowOffset++] = a;
        }
      }
    }

    return new Blob([buffer], { type: 'image/bmp' });
  }
}

window.BmpEncoder = BmpEncoder;
