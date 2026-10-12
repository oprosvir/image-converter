/**
 * Local Image Converter - ICO Encoder
 * Encodes canvas/image into Windows .ICO format with multi-resolution support.
 * Uses PNG-in-ICO standard (supported by Windows Vista, 7, 8, 10, 11 and all modern browsers).
 */

class IcoEncoder {
  /**
   * Generates a multi-size or single-size .ico Blob from a source canvas
   * @param {HTMLCanvasElement} sourceCanvas 
   * @param {number[]} sizes Array of resolutions, e.g. [16, 32, 48, 64, 128, 256]
   * @returns {Promise<Blob>}
   */
  static async createIcoBlob(sourceCanvas, sizes = [16, 32, 48, 64, 128, 256]) {
    // If only one size or custom sizes requested:
    const targetSizes = (Array.isArray(sizes) && sizes.length > 0) ? sizes : [16, 32, 48, 64];

    // Render each size to PNG buffer
    const images = [];
    for (const size of targetSizes) {
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = size;
      resizedCanvas.height = size;
      const ctx = resizedCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, 0, 0, size, size);

      const pngBlob = await new Promise((resolve) => {
        resizedCanvas.toBlob(resolve, 'image/png');
      });
      const pngBuffer = await pngBlob.arrayBuffer();

      images.push({
        width: size === 256 ? 0 : size, // 0 in ICO spec means 256
        height: size === 256 ? 0 : size,
        buffer: new Uint8Array(pngBuffer)
      });
    }

    const count = images.length;
    // ICONDIR: 6 bytes
    // ICONDIRENTRY: 16 bytes * count
    const headerSize = 6 + (16 * count);
    let totalSize = headerSize;
    for (const img of images) {
      totalSize += img.buffer.length;
    }

    const icoData = new Uint8Array(totalSize);
    const view = new DataView(icoData.buffer);

    // ICONDIR header
    view.setUint16(0, 0, true);      // Reserved = 0
    view.setUint16(2, 1, true);      // Type = 1 (Icon)
    view.setUint16(4, count, true);  // Number of images

    let currentOffset = headerSize;

    // ICONDIRENTRY array
    for (let i = 0; i < count; i++) {
      const img = images[i];
      const entryOffset = 6 + (i * 16);

      icoData[entryOffset + 0] = img.width;          // Width
      icoData[entryOffset + 1] = img.height;         // Height
      icoData[entryOffset + 2] = 0;                  // Color count (0 for 256+ colors)
      icoData[entryOffset + 3] = 0;                  // Reserved
      view.setUint16(entryOffset + 4, 1, true);       // Color planes (1)
      view.setUint16(entryOffset + 6, 32, true);      // Bits per pixel (32)
      view.setUint32(entryOffset + 8, img.buffer.length, true); // Size of image data
      view.setUint32(entryOffset + 12, currentOffset, true);    // Offset of image data

      // Copy image data to the buffer at currentOffset
      icoData.set(img.buffer, currentOffset);
      currentOffset += img.buffer.length;
    }

    return new Blob([icoData], { type: 'image/x-icon' });
  }
}

window.IcoEncoder = IcoEncoder;
