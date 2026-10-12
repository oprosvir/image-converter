/**
 * Local Image Converter - Application UI & State Management
 * 100% Client-side and offline.
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    queue: [],         // Array of Item objects
    isConverting: false,
    settings: {
      format: 'webp',
      quality: 0.85,
      icoSizes: [16, 32, 48, 64, 128, 256]
    }
  };

  // --- DOM Elements ---
  const el = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),
    queueList: document.getElementById('queueList'),
    queueContainer: document.getElementById('queueContainer'),
    globalFormat: document.getElementById('globalFormat'),
    qualityGroup: document.getElementById('qualityGroup'),
    qualitySlider: document.getElementById('qualitySlider'),
    qualityValue: document.getElementById('qualityValue'),
    pdfOptionsGroup: document.getElementById('pdfOptionsGroup'),
    icoOptionsGroup: document.getElementById('icoOptionsGroup'),
    btnConvertAll: document.getElementById('btnConvertAll'),
    btnDownloadZip: document.getElementById('btnDownloadZip'),
    btnDownloadPdf: document.getElementById('btnDownloadPdf'),
    btnClearAll: document.getElementById('btnClearAll'),
    statsBar: document.getElementById('statsBar'),
    statCount: document.getElementById('statCount'),
    statOrigSize: document.getElementById('statOrigSize'),
    statNewSize: document.getElementById('statNewSize'),
    themeToggle: document.getElementById('themeToggle'),
    previewModal: document.getElementById('previewModal'),
    modalClose: document.getElementById('modalClose'),
    previewOrigImg: document.getElementById('previewOrigImg'),
    previewNewImg: document.getElementById('previewNewImg'),
    previewOrigMeta: document.getElementById('previewOrigMeta'),
    previewNewMeta: document.getElementById('previewNewMeta'),
    btnPickFiles: document.getElementById('btnPickFiles'),
    btnPickFolder: document.getElementById('btnPickFolder')
  };

  // --- Utility Functions ---
  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function generateId() {
    return 'item_' + Math.random().toString(36).substring(2, 9);
  }

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem('imgconv_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('imgconv_theme', next);
  }

  // --- Settings UI Sync ---
  function updateSettingsVisibility() {
    const fmt = state.settings.format;

    // Quality slider is relevant for JPEG, JFIF, WebP, AVIF
    const hasQuality = ['jpg', 'jpeg', 'jfif', 'webp', 'avif'].includes(fmt);
    el.qualityGroup.style.display = hasQuality ? 'flex' : 'none';

    // ICO specific options
    el.icoOptionsGroup.style.display = (fmt === 'ico') ? 'block' : 'none';

    // PDF options
    el.pdfOptionsGroup.style.display = (fmt === 'pdf') ? 'flex' : 'none';
  }

  // --- Queue Handling ---
  async function addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      // Validate if image or supported format
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'gif', 'bmp', 'svg', 'ico', 'heic', 'heif'];
      const isImage = file.type.startsWith('image/') || validExtensions.includes(ext);

      if (!isImage) {
        continue; // Skip non-images
      }

      // Check for duplicates
      const exists = state.queue.some(it => it.file.name === file.name && it.file.size === file.size);
      if (exists) continue;

      const isHeic = (ext === 'heic' || ext === 'heif');
      let initialThumb = null;

      // For standard browser-renderable formats, create object URL synchronously
      if (!isHeic) {
        try {
          initialThumb = URL.createObjectURL(file);
        } catch (e) {
          initialThumb = null;
        }
      }

      const item = {
        id: generateId(),
        file: file,
        status: 'pending', // pending, converting, done, error
        progressText: 'Pending',
        result: null,
        error: null,
        format: state.settings.format,
        isCustom: false,
        thumbnailUrl: initialThumb
      };

      // For HEIC files, generate thumbnail asynchronously via heic2any in background
      if (isHeic && typeof window.heic2any === 'function') {
        window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.3 })
          .then(thumbBlob => {
            const blob = Array.isArray(thumbBlob) ? thumbBlob[0] : thumbBlob;
            const thumbUrl = URL.createObjectURL(blob);
            item.thumbnailUrl = thumbUrl;
            updateItemThumbnail(item.id, thumbUrl);
          })
          .catch(() => {
            // Keep text placeholder if HEIC decoding fails
          });
      }

      state.queue.push(item);
    }

    renderQueue();
    updateStats();
  }

  function updateItemThumbnail(id, thumbUrl) {
    if (!thumbUrl) return;
    const card = document.getElementById(id);
    if (!card) return;
    const thumbContainer = card.querySelector('.item-thumb');
    if (thumbContainer) {
      thumbContainer.innerHTML = `<img src="${thumbUrl}" alt="thumb">`;
    }
  }

  function removeItem(id) {
    const index = state.queue.findIndex(it => it.id === id);
    if (index !== -1) {
      const item = state.queue[index];
      if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      if (item.result && item.result.url && item.result.url !== item.thumbnailUrl) URL.revokeObjectURL(item.result.url);
      state.queue.splice(index, 1);
    }
    renderQueue();
    updateStats();
  }

  function clearAll() {
    state.queue.forEach(item => {
      if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      if (item.result && item.result.url && item.result.url !== item.thumbnailUrl) URL.revokeObjectURL(item.result.url);
    });
    state.queue = [];
    renderQueue();
    updateStats();
  }

  // --- Render Queue UI ---
  function renderQueue() {
    if (state.queue.length === 0) {
      el.queueContainer.style.display = 'none';
      el.statsBar.style.display = 'none';
      el.btnConvertAll.disabled = true;
      el.btnDownloadZip.disabled = true;
      el.btnDownloadPdf.disabled = true;
      return;
    }

    el.queueContainer.style.display = 'block';
    el.statsBar.style.display = 'flex';
    el.btnConvertAll.disabled = state.isConverting;

    const hasDoneItems = state.queue.some(it => it.status === 'done');
    el.btnDownloadZip.disabled = !hasDoneItems;
    el.btnDownloadPdf.disabled = state.queue.length === 0;

    el.queueList.innerHTML = '';
    state.queue.forEach(item => {
      el.queueList.appendChild(createItemElement(item));
    });
  }

  function createItemElement(item) {
    const card = document.createElement('div');
    card.id = item.id;
    card.className = `queue-card status-${item.status}`;

    const ext = (item.file.name.split('.').pop() || '').toUpperCase();
    const activeFormat = (item.format || state.settings.format).toLowerCase();

    // Badges & size info
    let resultInfoHtml = '';
    if (item.status === 'done' && item.result) {
      resultInfoHtml = `
        <div class="result-info">
          <span class="new-size">${formatBytes(item.result.newSize)}</span>
          <span class="dimens-badge">${item.result.width}×${item.result.height}</span>
        </div>
      `;
    } else if (item.status === 'converting') {
      resultInfoHtml = `
        <div class="converting-indicator">
          <div class="spinner"></div>
          <span>${item.progressText}</span>
        </div>
      `;
    } else if (item.status === 'error') {
      resultInfoHtml = `<span class="badge error-badge">Error: ${item.error || 'Failed'}</span>`;
    } else {
      resultInfoHtml = `<span class="badge pending-badge">Pending</span>`;
    }

    // Individual Action buttons
    let actionButtonsHtml = '';
    if (item.status === 'done' && item.result) {
      actionButtonsHtml = `
        <button class="btn btn-sm btn-outline preview-btn" title="Preview comparison" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn btn-sm btn-primary download-btn" title="Download file" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      `;
    }

    card.innerHTML = `
      <div class="item-thumb">
        ${item.thumbnailUrl 
          ? `<img src="${item.thumbnailUrl}" alt="thumb">` 
          : `<div class="thumb-placeholder">${ext}</div>`}
      </div>
      <div class="item-details">
        <div class="item-title" title="${item.file.name}">${item.file.name}</div>
        <div class="item-meta">
          <span class="orig-size">${formatBytes(item.file.size)}</span>
          <span class="arrow">➔</span>
          <select class="item-format-select" data-id="${item.id}">
            <option value="jpg" ${activeFormat === 'jpg' ? 'selected' : ''}>JPG</option>
            <option value="jfif" ${activeFormat === 'jfif' ? 'selected' : ''}>JFIF</option>
            <option value="png" ${activeFormat === 'png' ? 'selected' : ''}>PNG</option>
            <option value="webp" ${activeFormat === 'webp' ? 'selected' : ''}>WebP</option>
            <option value="avif" ${activeFormat === 'avif' ? 'selected' : ''}>AVIF</option>
            <option value="bmp" ${activeFormat === 'bmp' ? 'selected' : ''}>BMP</option>
            <option value="ico" ${activeFormat === 'ico' ? 'selected' : ''}>ICO</option>
            <option value="pdf" ${activeFormat === 'pdf' ? 'selected' : ''}>PDF</option>
          </select>
        </div>
      </div>
      <div class="item-result">
        ${resultInfoHtml}
      </div>
      <div class="item-actions">
        ${actionButtonsHtml}
        <button class="btn btn-sm btn-icon remove-btn" title="Remove" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    // Bind event handlers
    const formatSelect = card.querySelector('.item-format-select');
    formatSelect.addEventListener('change', (e) => {
      item.format = e.target.value;
      item.isCustom = true;
      item.status = 'pending';
      item.result = null;
      renderQueue();
      updateStats();
    });

    const removeBtn = card.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => removeItem(item.id));

    const downloadBtn = card.querySelector('.download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadSingleItem(item));
    }

    const previewBtn = card.querySelector('.preview-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => showPreview(item));
    }

    return card;
  }

  // --- Statistics Calculation ---
  function updateStats() {
    const total = state.queue.length;
    el.statCount.textContent = total;

    let origBytes = 0;
    let newBytes = 0;
    let doneCount = 0;

    state.queue.forEach(item => {
      origBytes += item.file.size;
      if (item.status === 'done' && item.result) {
        newBytes += item.result.newSize;
        doneCount++;
      }
    });

    el.statOrigSize.textContent = formatBytes(origBytes);

    if (doneCount === 0) {
      el.statNewSize.textContent = '—';
    } else {
      const isPartial = doneCount < total;
      el.statNewSize.textContent = formatBytes(newBytes) + (isPartial ? ` (${doneCount}/${total})` : '');
    }
  }

  // --- Conversion Process ---
  async function convertAll() {
    if (state.isConverting || state.queue.length === 0) return;

    state.isConverting = true;
    el.btnConvertAll.disabled = true;
    el.btnConvertAll.innerHTML = '<div class="spinner"></div> Converting...';

    // Active options snapshot
    const options = {
      format: state.settings.format,
      quality: state.settings.quality,
      icoSizes: state.settings.icoSizes
    };

    for (let i = 0; i < state.queue.length; i++) {
      const item = state.queue[i];

      // Convert only pending or failed items, or update if format overridden
      item.status = 'converting';
      item.progressText = 'Processing...';
      renderQueue();

      try {
        const itemOptions = {
          ...options,
          format: item.format || state.settings.format
        };

        const result = await window.ImageConverter.convert(item.file, itemOptions, (msg) => {
          item.progressText = msg;
          const card = document.getElementById(item.id);
          if (card) {
            const span = card.querySelector('.converting-indicator span');
            if (span) span.textContent = msg;
          }
        });

        item.status = 'done';
        item.result = result;
        item.error = null;

        // If thumbnail was missing (e.g. HEIC), use converted result
        if (!item.thumbnailUrl && result.url) {
          item.thumbnailUrl = result.url;
        }
      } catch (err) {
        console.error('Conversion error:', err);
        item.status = 'error';
        item.error = err.message || 'Processing failed';
      }

      renderQueue();
      updateStats();
    }

    state.isConverting = false;
    el.btnConvertAll.disabled = false;
    el.btnConvertAll.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Convert All
    `;
    renderQueue();
    updateStats();
  }

  // --- Downloads ---
  function downloadSingleItem(item) {
    if (!item.result || !item.result.blob) return;
    const a = document.createElement('a');
    a.href = item.result.url;
    a.download = item.result.outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function downloadZip() {
    const doneItems = state.queue.filter(it => it.status === 'done' && it.result);
    if (doneItems.length === 0) return;

    el.btnDownloadZip.disabled = true;
    el.btnDownloadZip.innerHTML = '<div class="spinner"></div> Creating ZIP...';

    try {
      const zip = new window.JSZip();
      const usedNames = new Set();

      for (const it of doneItems) {
        let name = it.result.outputName;
        // Avoid duplicate filenames in zip
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf('.');
          const base = dot !== -1 ? name.substring(0, dot) : name;
          const ext = dot !== -1 ? name.substring(dot) : '';
          let count = 2;
          while (usedNames.has(`${base}_${count}${ext}`)) {
            count++;
          }
          name = `${base}_${count}${ext}`;
        }
        usedNames.add(name);

        zip.file(name, it.result.blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `converted_images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('Error creating ZIP archive: ' + e.message);
    } finally {
      el.btnDownloadZip.disabled = false;
      el.btnDownloadZip.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download ZIP
      `;
    }
  }

  async function downloadSinglePdfDoc() {
    const doneItems = state.queue.filter(it => it.status === 'done');
    const itemsToMerge = doneItems.length > 0 ? doneItems : state.queue;
    if (itemsToMerge.length === 0) return;

    el.btnDownloadPdf.disabled = true;
    el.btnDownloadPdf.innerHTML = '<div class="spinner"></div> Generating PDF...';

    try {
      const pdfBlob = await window.ImageConverter.createMultiPagePdf(
        itemsToMerge,
        {},
        (msg) => {
          el.btnDownloadPdf.innerHTML = `<div class="spinner"></div> ${msg}`;
        }
      );

      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = `documents_scan_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Error merging into PDF: ' + e.message);
    } finally {
      el.btnDownloadPdf.disabled = false;
      el.btnDownloadPdf.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Merge to PDF
      `;
    }
  }

  // --- Modal Preview ---
  function showPreview(item) {
    if (!item.result) return;

    el.previewOrigImg.src = item.thumbnailUrl || '';
    el.previewNewImg.src = item.result.url || '';

    el.previewOrigMeta.textContent = `${item.file.name} (${formatBytes(item.result.originalSize)}, ${item.result.originalWidth}×${item.result.originalHeight} px)`;
    el.previewNewMeta.textContent = `${item.result.outputName} (${formatBytes(item.result.newSize)}, ${item.result.width}×${item.result.height} px)`;

    el.previewModal.style.display = 'flex';
  }

  function closePreview() {
    el.previewModal.style.display = 'none';
  }

  // --- Event Listeners Initialization ---
  function initEvents() {
    // Theme toggle
    el.themeToggle.addEventListener('click', toggleTheme);

    // Pick files buttons
    el.btnPickFiles.addEventListener('click', () => el.fileInput.click());
    el.btnPickFolder.addEventListener('click', () => el.folderInput.click());
    el.fileInput.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });
    el.folderInput.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });

    // Drag & Drop anywhere on window
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      el.dropZone.classList.add('drag-active');
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        el.dropZone.classList.remove('drag-active');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      el.dropZone.classList.remove('drag-active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    });

    // Global Format change
    el.globalFormat.addEventListener('change', (e) => {
      state.settings.format = e.target.value;
      state.queue.forEach(item => {
        if (!item.isCustom && item.status !== 'converting') {
          item.format = state.settings.format;
          item.status = 'pending';
          item.result = null;
        }
      });
      updateSettingsVisibility();
      renderQueue();
      updateStats();
    });

    // Quality slider
    el.qualitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.quality = val / 100;
      el.qualityValue.textContent = val + '%';
    });

    // Main Actions
    el.btnConvertAll.addEventListener('click', convertAll);
    el.btnDownloadZip.addEventListener('click', downloadZip);
    el.btnDownloadPdf.addEventListener('click', downloadSinglePdfDoc);
    el.btnClearAll.addEventListener('click', clearAll);

    // Modal
    el.modalClose.addEventListener('click', closePreview);
    el.previewModal.addEventListener('click', (e) => {
      if (e.target === el.previewModal) closePreview();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePreview();
    });
  }

  // --- Bootstrap ---
  function init() {
    initTheme();
    initEvents();
    updateSettingsVisibility();
    renderQueue();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
