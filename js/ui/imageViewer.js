'use strict';
/* ═══════════════════════════════════════════════════════════
   IMAGEVIEWER.JS — Visor de imagen con zoom y paneo
   Muestra una señal a pantalla completa. Soporta:
   - Zoom con botones +/− y con pellizco (pinch) táctil
   - Paneo arrastrando (un dedo o ratón)
   - Doble toque para alternar zoom
   ═══════════════════════════════════════════════════════════ */
const ImageViewer = (() => {
  let canvas, ctx, wrap, viewer, zoomLabel, titleEl;
  let sourceCanvas = null;       // imagen a mostrar
  let scale = 1, minScale = 1, maxScale = 6;
  let offsetX = 0, offsetY = 0;  // desplazamiento del paneo
  let isPanning = false, startX = 0, startY = 0;
  let lastPinchDist = 0;
  let initialized = false;

  function init() {
    if (initialized) return;
    viewer    = document.getElementById('image-viewer');
    canvas    = document.getElementById('viewer-canvas');
    wrap      = document.getElementById('viewer-canvas-wrap');
    zoomLabel = document.getElementById('viewer-zoom-label');
    titleEl   = document.getElementById('viewer-title');
    if (!viewer || !canvas) return;
    ctx = canvas.getContext('2d');

    document.getElementById('viewer-close').onclick   = close;
    document.getElementById('viewer-zoom-in').onclick  = () => zoomBy(1.4);
    document.getElementById('viewer-zoom-out').onclick = () => zoomBy(1/1.4);
    document.getElementById('viewer-reset').onclick    = reset;

    // Ratón (escritorio)
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Táctil (móvil)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // Doble toque / doble clic
    let lastTap = 0;
    canvas.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (scale > minScale * 1.5) reset();
        else zoomBy(2.5);
      }
      lastTap = now;
    });

    initialized = true;
  }

  // Abre el visor con un canvas de imagen
  function open(imgCanvas, title) {
    init();
    if (!imgCanvas) return;
    sourceCanvas = imgCanvas;
    if (titleEl) titleEl.textContent = title || 'Señal';
    viewer.style.display = 'flex';

    // Ajustar el canvas del visor al tamaño disponible
    requestAnimationFrame(() => {
      const rect = wrap.getBoundingClientRect();
      canvas.width  = rect.width;
      canvas.height = rect.height;
      reset();
    });
  }

  function close() {
    viewer.style.display = 'none';
    sourceCanvas = null;
  }

  function reset() {
    // Encajar la imagen centrada
    if (!sourceCanvas) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = sourceCanvas.width, ih = sourceCanvas.height;
    minScale = Math.min(cw / iw, ch / ih) * 0.95;
    scale = minScale;
    offsetX = (cw - iw * scale) / 2;
    offsetY = (ch - ih * scale) / 2;
    render();
  }

  function zoomBy(factor, cx, cy) {
    if (!sourceCanvas) return;
    // Punto de anclaje (centro por defecto)
    cx = cx ?? canvas.width / 2;
    cy = cy ?? canvas.height / 2;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    // Ajustar offset para hacer zoom hacia el punto
    offsetX = cx - (cx - offsetX) * (newScale / scale);
    offsetY = cy - (cy - offsetY) * (newScale / scale);
    scale = newScale;
    clampOffset();
    render();
  }

  function clampOffset() {
    // Evitar que la imagen se salga demasiado
    const iw = sourceCanvas.width * scale;
    const ih = sourceCanvas.height * scale;
    const cw = canvas.width, ch = canvas.height;
    if (iw <= cw) offsetX = (cw - iw) / 2;
    else offsetX = Math.min(0, Math.max(cw - iw, offsetX));
    if (ih <= ch) offsetY = (ch - ih) / 2;
    else offsetY = Math.min(0, Math.max(ch - ih, offsetY));
  }

  function render() {
    if (!sourceCanvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, offsetX, offsetY,
                  sourceCanvas.width * scale, sourceCanvas.height * scale);
    if (zoomLabel) zoomLabel.textContent = Math.round(scale / minScale * 100) + '%';
  }

  // ── Ratón ──
  function onDown(e) { isPanning = true; startX = e.clientX - offsetX; startY = e.clientY - offsetY; }
  function onMove(e) {
    if (!isPanning) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    clampOffset(); render();
  }
  function onUp() { isPanning = false; }
  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.15 : 1/1.15, e.clientX - rect.left, e.clientY - rect.top);
  }

  // ── Táctil ──
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX - offsetX;
      startY = e.touches[0].clientY - offsetY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      lastPinchDist = pinchDist(e);
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      offsetX = e.touches[0].clientX - startX;
      offsetY = e.touches[0].clientY - startY;
      clampOffset(); render();
    } else if (e.touches.length === 2) {
      const dist = pinchDist(e);
      if (lastPinchDist > 0) {
        const rect = canvas.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        zoomBy(dist / lastPinchDist, midX, midY);
      }
      lastPinchDist = dist;
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length === 0) { isPanning = false; lastPinchDist = 0; }
  }
  function pinchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  return { init, open, close };
})();
