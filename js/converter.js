/**
 * Local Image Converter - Core Conversion Engine
 * Runs 100% locally in browser memory without network requests.
 */

class ImageConverter {
  /**
   * Check browser format support
   */
  static isFormatSupported(mimeType) {
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      return c.toDataURL(mimeType).startsWith(`data:${mimeType}`);
    } catch (e) {
      return false;
    }
  }

  /**
   * Determine MIME type from target format string
   */
  static getMimeType(format) {
    const f = (format || '').toLowerCase();
    switch (f) {
      case 'jpg':
      case 'jpeg':
      case 'jfif':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'avif':
        return 'image/avif';
      case 'bmp':
        return 'image/bmp';
      case 'ico':
        return 'image/x-icon';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'image/png';
    }
  }



  /**
   * Load any file into an HTMLImageElement, decoding HEIC if needed
   */
  static async loadImageElement(file, onProgress) {
    if (file instanceof HTMLImageElement) {
      return file;
    }
    const fileName = file.name || '';
    const fileType = file.type || '';
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const isHeic = ext === 'heic' || ext === 'heif' || fileType.includes('heic') || fileType.includes('heif');

    let imageBlob = file;

    if (isHeic) {
      if (onProgress) onProgress('Decoding HEIC (Apple)...');
      if (typeof window.heic2any !== 'function') {
        throw new Error('heic2any library is not loaded.');
      }
      const converted = await window.heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95
      });
      imageBlob = Array.isArray(converted) ? converted[0] : converted;
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(imageBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load image: ${fileName || 'image'}`));
      };
      img.src = url;
    });
  }

  /**
   * Render source image to canvas with high quality smoothing
   */
  static renderToCanvas(img, width, height, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill background for non-transparent formats
    const targetFormat = (options.format || 'jpg').toLowerCase();
    const needsSolidBg = ['jpg', 'jpeg', 'jfif'].includes(targetFormat);

    if (needsSolidBg) {
      ctx.fillStyle = options.backgroundColor || '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
  }

  /**
   * Convert single image file
   */
  static async convert(file, options = {}, onProgress = null) {
    if (onProgress) onProgress('Reading file...');

    const targetFormat = (options.format || 'jpg').toLowerCase();
    const quality = typeof options.quality === 'number' ? Math.max(0.01, Math.min(1.0, options.quality)) : 0.85;

    // 1. Load Image
    const img = await this.loadImageElement(file, onProgress);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // 2. Exact original dimensions (no automatic resizing)
    const width = origW;
    const height = origH;

    // 3. Render to canvas
    if (onProgress) onProgress('Rendering image...');
    const canvas = this.renderToCanvas(img, width, height, options);

    let resultBlob = null;
    let extension = targetFormat;

    // 4. Encode to target format
    if (onProgress) onProgress(`Encoding to .${targetFormat.toUpperCase()}...`);

    if (targetFormat === 'ico') {
      const icoSizes = options.icoSizes || [16, 32, 48, 64, 128, 256];
      resultBlob = await window.IcoEncoder.createIcoBlob(canvas, icoSizes);
      extension = 'ico';
    } else if (targetFormat === 'bmp') {
      resultBlob = window.BmpEncoder.canvasToBmpBlob(canvas, false);
      extension = 'bmp';
    } else if (targetFormat === 'pdf') {
      resultBlob = await this.createSingleImagePdf(canvas, file.name);
      extension = 'pdf';
    } else {
      let mimeType = this.getMimeType(targetFormat);
      
      // Fallback for AVIF if not supported by browser canvas
      if (mimeType === 'image/avif' && !this.isFormatSupported('image/avif')) {
        console.warn('Browser does not support native AVIF canvas export, falling back to WebP');
        mimeType = 'image/webp';
        extension = 'webp';
      }

      resultBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error(`Failed to encode to ${mimeType}`));
          },
          mimeType,
          quality
        );
      });

      // Retain requested extension (e.g. jfif vs jpg)
      if (targetFormat === 'jfif') extension = 'jfif';
      else if (targetFormat === 'jpeg') extension = 'jpeg';
      else if (targetFormat === 'jpg') extension = 'jpg';
      else if (targetFormat === 'png') extension = 'png';
      else if (targetFormat === 'webp') extension = 'webp';
      else if (targetFormat === 'avif') extension = 'avif';
    }

    // Determine target filename
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const outputFileName = `${baseName}.${extension}`;

    return {
      originalFile: file,
      originalName: file.name,
      outputName: outputFileName,
      blob: resultBlob,
      url: URL.createObjectURL(resultBlob),
      originalSize: file.size,
      newSize: resultBlob.size,
      originalWidth: origW,
      originalHeight: origH,
      width: width,
      height: height,
      format: extension
    };
  }

  /**
   * Create a PDF containing a single image
   */
  static async createSingleImagePdf(canvas, originalName) {
    const { jsPDF } = window.jspdf;
    const isLandscape = canvas.width > canvas.height;
    const orientation = isLandscape ? 'l' : 'p';

    // A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Scale to fit page with 10mm margins
    const margin = 10;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const renderW = canvas.width * ratio;
    const renderH = canvas.height * ratio;
    const posX = margin + (maxW - renderW) / 2;
    const posY = margin + (maxH - renderH) / 2;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', posX, posY, renderW, renderH);

    return pdf.output('blob');
  }

  /**
   * Multi-page PDF for scanned documents (combines all images into one PDF)
   */
  static async createMultiPagePdf(items, options = {}, onProgress = null) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF library is not loaded');
    }
    const { jsPDF } = window.jspdf;
    let pdf = null;

    const total = items.length;
    for (let i = 0; i < total; i++) {
      if (onProgress) onProgress(`Processing page ${i + 1} of ${total}...`);
      const item = items[i];

      // Retrieve source image: always use original file or non-pdf blob
      const source = item.file || item.originalFile || (item.result && (item.result.originalFile || item.result.file)) || (item.blob && item.format !== 'pdf' ? item.blob : null) || item;

      const img = await this.loadImageElement(source, onProgress);
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // Render to clean canvas to get reliable JPEG data and white background for transparency
      const canvas = document.createElement('canvas');
      canvas.width = imgW;
      canvas.height = imgH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, imgW, imgH);
      ctx.drawImage(img, 0, 0);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      const isLandscape = imgW > imgH;
      const orientation = isLandscape ? 'l' : 'p';

      if (i === 0) {
        pdf = new jsPDF({
          orientation: orientation,
          unit: 'mm',
          format: 'a4',
          compress: true
        });
      } else {
        pdf.addPage('a4', orientation);
      }

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const ratio = Math.min(maxW / imgW, maxH / imgH);
      const renderW = imgW * ratio;
      const renderH = imgH * ratio;
      const posX = margin + (maxW - renderW) / 2;
      const posY = margin + (maxH - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');
    }

    if (!pdf) {
      throw new Error('No pages were generated.');
    }

    return pdf.output('blob');
  }
}

window.ImageConverter = ImageConverter;
