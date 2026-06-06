'use strict';
/* ══════════════════════════════════════════
   DETECTION-UI.JS — Dibuja bboxes en canvas
   y mantiene lista de detecciones activas
   ══════════════════════════════════════════ */
const DetectionUI = (() => {
  let _activeDetections = []; // detecciones acumuladas en la sesión de vídeo
  let _detectionCanvas = null;

  const TYPE_COLORS = {
    peligro:     '#f59e0b',
    prioridad:   '#ef4444',
    prohibicion: '#ef4444',
    velocidad:   '#ef4444',
    obligacion:  '#22c55e',
    informacion: '#3b82f6',
    horizontal:  '#06b6d4',
    desconocido: '#f5c518',
  };

  function init(canvasEl) {
    _detectionCanvas = canvasEl;
  }

  // Dibuja bounding boxes en el canvas overlay de vídeo
  function drawDetections(canvas, detections) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
      const [x, y, w, h] = det.bbox;
      const color = TYPE_COLORS[det.category] || '#f5c518';
      const info = SIGN_CATALOG[det.signType];

      // Sombra suave
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      // Bbox
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Esquinas decorativas
      _drawCorners(ctx, x, y, w, h, color);

      // Label
      const label = info?.label || det.signType;
      const confPct = Math.round(det.confidence * 100);
      const text = `${label} ${confPct}%`;
      ctx.font = 'bold 11px Barlow Condensed, sans-serif';
      const tw = ctx.measureText(text).width;
      const lx = x, ly = y > 20 ? y - 6 : y + h + 14;
      ctx.fillStyle = color;
      ctx.fillRect(lx - 2, ly - 12, tw + 8, 16);
      ctx.fillStyle = '#000';
      ctx.fillText(text, lx + 2, ly);
    }
  }

  function _drawCorners(ctx, x, y, w, h, color) {
    const s = Math.min(14, w*0.25, h*0.25);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // TL
    ctx.beginPath(); ctx.moveTo(x, y+s); ctx.lineTo(x, y); ctx.lineTo(x+s, y); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(x+w-s, y); ctx.lineTo(x+w, y); ctx.lineTo(x+w, y+s); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(x, y+h-s); ctx.lineTo(x, y+h); ctx.lineTo(x+s, y+h); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(x+w-s, y+h); ctx.lineTo(x+w, y+h); ctx.lineTo(x+w, y+h-s); ctx.stroke();
  }

  // Acumula detecciones en la sesión (deduplica por signType+posición)
  function accumulate(newDetections) {
    for (const det of newDetections) {
      const dup = _activeDetections.find(d =>
        d.signType === det.signType &&
        Math.abs(d.bbox[0] - det.bbox[0]) < 40 &&
        Math.abs(d.bbox[1] - det.bbox[1]) < 40
      );
      if (!dup) {
        _activeDetections.push(det);
      } else {
        // Actualizar con mayor confianza
        if (det.confidence > dup.confidence) {
          Object.assign(dup, det);
        }
      }
    }
    return _activeDetections;
  }

  function getAccumulated() { return [..._activeDetections]; }

  function clearAccumulated() { _activeDetections = []; }

  // Dibuja en canvas foto (estático)
  function drawOnPhoto(canvas, detections) {
    drawDetections(canvas, detections);
  }

  return { init, drawDetections, accumulate, getAccumulated, clearAccumulated, drawOnPhoto };
})();
