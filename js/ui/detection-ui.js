'use strict';
const DetectionUI = (() => {
  let _activeDetections = [];
  const MAX_ACCUMULATED = 8;

  const TYPE_COLORS = {
    peligro:'#f59e0b', prioridad:'#ef4444', prohibicion:'#ef4444',
    velocidad:'#ef4444', obligacion:'#22c55e', informacion:'#3b82f6',
    horizontal:'#06b6d4', desconocido:'#f5c518',
  };

  function init(canvasEl) {}

  // BUG4 FIX: siempre limpiar canvas, incluso si detections está vacío
  function drawDetections(overlayCanvas, detections) {
    const ctx = overlayCanvas.getContext('2d');

    // BUG2 FIX: ajustar tamaño del canvas overlay al tamaño CSS real del elemento
    // para que los recuadros aparezcan en la posición correcta
    const rect = overlayCanvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (overlayCanvas.width !== Math.round(rect.width) ||
          overlayCanvas.height !== Math.round(rect.height)) {
        overlayCanvas.width  = Math.round(rect.width);
        overlayCanvas.height = Math.round(rect.height);
      }
    }

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!detections || detections.length === 0) return;

    const cW = overlayCanvas.width;
    const cH = overlayCanvas.height;

    for (const det of detections) {
      // Los bbox vienen en coordenadas del canvas de análisis (videoWidth x videoHeight)
      // Necesitamos escalarlos al tamaño del overlay
      // El bbox viene del offscreen (vídeo nativo), el overlay tiene tamaño CSS
      // Usamos el ratio del canvas de análisis guardado en det
      const [bx, by, bw, bh] = det.bbox;
      // Si det tiene sourceSize, escalar; si no, usar como están
      const srcW = det.sourceW || cW;
      const srcH = det.sourceH || cH;
      const scaleX = cW / srcW;
      const scaleY = cH / srcH;
      const x = bx * scaleX;
      const y = by * scaleY;
      const w = bw * scaleX;
      const h = bh * scaleY;

      const color = TYPE_COLORS[det.category] || '#f5c518';
      const info  = SIGN_CATALOG[det.signType];

      ctx.shadowColor = color;
      ctx.shadowBlur  = 6;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      _drawCorners(ctx, x, y, w, h, color);

      const label = info?.label || det.signType;
      const text  = `${label}  ${Math.round(det.confidence*100)}%`;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(text).width;
      const ly = y > 24 ? y - 6 : y + h + 16;
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, ly - 13, tw + 10, 17);
      ctx.fillStyle = '#000';
      ctx.fillText(text, x + 3, ly);
    }
  }

  function _drawCorners(ctx, x, y, w, h, color) {
    const s = Math.min(12, w * 0.2, h * 0.2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    // TL
    ctx.beginPath(); ctx.moveTo(x, y+s); ctx.lineTo(x, y); ctx.lineTo(x+s, y); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(x+w-s, y); ctx.lineTo(x+w, y); ctx.lineTo(x+w, y+s); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(x, y+h-s); ctx.lineTo(x, y+h); ctx.lineTo(x+s, y+h); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(x+w-s, y+h); ctx.lineTo(x+w, y+h); ctx.lineTo(x+w, y+h-s); ctx.stroke();
  }

  // BUG3 FIX: acumulación limitada y con TTL (3 segundos)
  function accumulate(newDetections) {
    const now = Date.now();
    const TTL = 3000; // 3 segundos

    // Eliminar detecciones antiguas
    _activeDetections = _activeDetections.filter(d => (now - d.ts) < TTL);

    for (const det of newDetections) {
      const dup = _activeDetections.find(d =>
        d.signType === det.signType &&
        Math.abs(d.bbox[0] - det.bbox[0]) < 60 &&
        Math.abs(d.bbox[1] - det.bbox[1]) < 60
      );
      if (!dup) {
        _activeDetections.push({ ...det, ts: now });
      } else if (det.confidence > dup.confidence) {
        Object.assign(dup, det, { ts: now });
      }
    }

    // BUG3 FIX: limitar a MAX_ACCUMULATED
    if (_activeDetections.length > MAX_ACCUMULATED) {
      _activeDetections = _activeDetections
        .sort((a,b) => b.confidence - a.confidence)
        .slice(0, MAX_ACCUMULATED);
    }

    return _activeDetections;
  }

  // En vídeo en tiempo real, mostrar solo las del frame actual (sin acumular)
  function drawCurrentFrame(overlayCanvas, detections) {
    drawDetections(overlayCanvas, detections);
  }

  function getAccumulated()  { return [..._activeDetections]; }
  function clearAccumulated(){ _activeDetections = []; }
  function drawOnPhoto(canvas, detections) { drawDetections(canvas, detections); }

  return { init, drawDetections, drawCurrentFrame, accumulate, getAccumulated, clearAccumulated, drawOnPhoto };
})();
