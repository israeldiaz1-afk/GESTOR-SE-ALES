'use strict';
const DetectionUI = (() => {
  let _accumulated = []; // detecciones acumuladas para evaluación
  const TTL = 4000; // 4 segundos de vida por detección

  const COLORS = {
    peligro:'#f59e0b', prioridad:'#ef4444', prohibicion:'#ef4444',
    velocidad:'#ef4444', obligacion:'#22c55e', informacion:'#3b82f6',
    horizontal:'#06b6d4', desconocido:'#f5c518',
  };

  // Dibuja detecciones en el canvas overlay
  // overlayCanvas: el elemento canvas visible al usuario
  // detections: array con {bbox:[x,y,w,h], sourceW, sourceH, ...}
  function drawDetections(overlayCanvas, detections) {
    // Ajustar canvas al tamaño del elemento (importante en móvil)
    const dpr = window.devicePixelRatio || 1;
    const rect = overlayCanvas.getBoundingClientRect();
    const cssW = rect.width  || overlayCanvas.offsetWidth  || 640;
    const cssH = rect.height || overlayCanvas.offsetHeight || 480;

    if (overlayCanvas.width !== Math.round(cssW) || overlayCanvas.height !== Math.round(cssH)) {
      overlayCanvas.width  = Math.round(cssW);
      overlayCanvas.height = Math.round(cssH);
    }

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!detections || detections.length === 0) return;

    for (const det of detections) {
      // Escalar bbox del espacio fuente (vídeo nativo) al espacio overlay (CSS)
      const srcW = det.sourceW || overlayCanvas.width;
      const srcH = det.sourceH || overlayCanvas.height;
      const sx = overlayCanvas.width  / srcW;
      const sy = overlayCanvas.height / srcH;

      const [bx, by, bw, bh] = det.bbox;
      const x = bx*sx, y = by*sy, w = bw*sx, h = bh*sy;

      if (w < 5 || h < 5) continue; // bbox demasiado pequeño tras escalar

      const color = COLORS[det.category] || '#f5c518';
      // En vídeo rápido las señales aún no están identificadas: mostrar "Señal"
      const name = det.pendingId ? 'Señal' : (SIGN_CATALOG[det.signType]?.label || det.signType);
      const label = name + ' ' + Math.round(det.confidence*100) + '%';

      // Recuadro
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();

      // Esquinas decorativas
      _corners(ctx, x, y, w, h, color);

      // Etiqueta
      ctx.font = `bold ${Math.max(10, Math.min(14, w/6))}px sans-serif`;
      const tw  = ctx.measureText(label).width;
      const lx  = Math.max(0, Math.min(x, overlayCanvas.width - tw - 8));
      const ly  = y > 20 ? y - 4 : y + h + 16;
      ctx.fillStyle = color + 'dd';
      ctx.fillRect(lx - 2, ly - 14, tw + 8, 17);
      ctx.fillStyle = '#000';
      ctx.fillText(label, lx + 2, ly);
    }
  }

  function _corners(ctx, x, y, w, h, color) {
    const s = Math.min(10, w*0.2, h*0.2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(x,y+s); ctx.lineTo(x,y); ctx.lineTo(x+s,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-s,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y+h-s); ctx.lineTo(x,y+h); ctx.lineTo(x+s,y+h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-s,y+h); ctx.lineTo(x+w,y+h); ctx.lineTo(x+w,y+h-s); ctx.stroke();
  }

  // Acumula detecciones del frame actual (para el botón Evaluar)
  function accumulate(dets) {
    const now = Date.now();
    // Limpiar expiradas
    _accumulated = _accumulated.filter(d => now - d._accTs < TTL);
    // Añadir o actualizar
    for (const det of dets) {
      const dup = _accumulated.find(d =>
        d.signType === det.signType &&
        Math.abs(d.bbox[0]-det.bbox[0]) < 80 &&
        Math.abs(d.bbox[1]-det.bbox[1]) < 80
      );
      if (!dup) {
        _accumulated.push({ ...det, _accTs: now });
      } else if (det.confidence > dup.confidence) {
        Object.assign(dup, det, { _accTs: now });
      }
    }
    // Limitar
    if (_accumulated.length > 6) {
      _accumulated = _accumulated.sort((a,b)=>b.confidence-a.confidence).slice(0,6);
    }
    return _accumulated;
  }

  function getAccumulated()  { return [..._accumulated]; }
  function clearAccumulated(){ _accumulated = []; }
  function drawOnPhoto(canvas, dets) {
    // En modo foto, el canvas YA contiene la foto dibujada y su tamaño
    // coincide con el espacio de las detecciones (sized). NO redimensionar
    // ni borrar: dibujar las cajas directamente encima de la foto.
    if (!dets || dets.length === 0) return;
    const ctx = canvas.getContext('2d');

    for (const det of dets) {
      // Las coordenadas vienen en el espacio del canvas de análisis (sized),
      // que es el MISMO canvas. sourceW/H deberían igualar canvas.width/height.
      const srcW = det.sourceW || canvas.width;
      const srcH = det.sourceH || canvas.height;
      const sx = canvas.width  / srcW;
      const sy = canvas.height / srcH;

      const [bx, by, bw, bh] = det.bbox;
      const x = bx*sx, y = by*sy, w = bw*sx, h = bh*sy;
      if (w < 4 || h < 4) continue;

      const color = COLORS[det.category] || '#f5c518';
      const label = (SIGN_CATALOG[det.signType]?.label || det.signType) + ' ' + Math.round((det.confidence||0)*100) + '%';

      // Grosor proporcional al tamaño de la imagen (visible en foto grande)
      const lw = Math.max(3, canvas.width / 200);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.shadowColor = color;
      ctx.shadowBlur = lw * 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();

      // Etiqueta
      const fontSize = Math.max(14, canvas.width / 32);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const tw = ctx.measureText(label).width;
      const ly = y > fontSize + 6 ? y - 4 : y + h + fontSize + 2;
      ctx.fillStyle = color;
      ctx.fillRect(x - lw/2, ly - fontSize, tw + 10, fontSize + 6);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 4, ly);
    }
  }

  return { drawDetections, accumulate, getAccumulated, clearAccumulated, drawOnPhoto };
})();
