'use strict';
/* ═══════════════════════════════════════════════════════════
   SIGNTRACKER.JS — Seguimiento y selección de mejor imagen
   Durante la grabación de vídeo, agrupa las detecciones que
   corresponden a la MISMA señal física (por proximidad espacial
   y clase) y conserva solo el MEJOR fotograma de cada una.

   "Mejor" = mayor puntuación de calidad, que combina:
     - Tamaño de la caja (señal más cercana = más píxeles = mejor)
     - Nitidez / enfoque (varianza del Laplaciano del recorte)
     - Centrado (señales centradas suelen estar mejor capturadas)
     - Confianza del detector

   Al pulsar "Evaluar", se devuelven los mejores recortes para
   calificar cada señal sobre su imagen óptima, no el último frame.
   ═══════════════════════════════════════════════════════════ */
const SignTracker = (() => {
  // Cada track: { id, classId, label, color, bestCrop, bestScore,
  //               bestBbox, bestFullFrame, lastSeen, centroid, count }
  let _tracks = [];
  let _nextId = 1;

  const MATCH_DISTANCE = 0.18; // distancia relativa máx para considerar misma señal
  const TRACK_TTL = 2500;      // ms sin ver una señal antes de cerrarla (en vídeo)

  // OPTIMIZACIÓN: canvas de nitidez reutilizable (singleton, se usa y descarta)
  let _sharpCanvas = null;
  let _sharpCtx = null;

  function reset() {
    _tracks = [];
    _nextId = 1;
  }

  // Procesa las detecciones de un frame.
  // detections: [{bbox:[x,y,w,h], score, classId, label, color, crop}]
  // fullFrameCanvas: el frame completo (para extraer recorte de calidad)
  // frameW, frameH: dimensiones del frame
  function update(detections, fullFrameCanvas, frameW, frameH) {
    const now = Date.now();

    for (const det of detections) {
      const [x, y, w, h] = det.bbox;
      const cx = (x + w/2) / frameW;
      const cy = (y + h/2) / frameH;

      // Calcular calidad de esta detección
      const quality = _computeQuality(det, fullFrameCanvas, frameW, frameH);

      // Buscar un track existente que coincida (misma clase + cerca)
      let match = null;
      let bestDist = MATCH_DISTANCE;
      for (const t of _tracks) {
        if (t.classId !== det.classId) continue;
        const d = Math.hypot(t.centroid[0] - cx, t.centroid[1] - cy);
        if (d < bestDist) { bestDist = d; match = t; }
      }

      if (match) {
        // Actualizar centroide (media móvil) y contador
        match.centroid[0] = match.centroid[0] * 0.6 + cx * 0.4;
        match.centroid[1] = match.centroid[1] * 0.6 + cy * 0.4;
        match.lastSeen = now;
        match.count++;
        // ¿Es mejor fotograma que el guardado?
        if (quality > match.bestScore) {
          match.bestScore = quality;
          match.bestBbox = det.bbox.slice();
          match.bestCrop = _extractCrop(fullFrameCanvas, det.bbox);
          match.confidence = det.score;
        }
      } else {
        // Nuevo track
        _tracks.push({
          id: _nextId++,
          classId: det.classId,
          label: det.label,
          color: det.color,
          signType: det.signType,
          category: det.category,
          centroid: [cx, cy],
          bestScore: quality,
          bestBbox: det.bbox.slice(),
          bestCrop: _extractCrop(fullFrameCanvas, det.bbox),
          confidence: det.score,
          isHorizontal: det.isHorizontal,
          lastSeen: now,
          firstSeen: now,
          count: 1,
          gps: det.gps || (window.Geo ? Geo.getPos() : null),
        });
      }
    }
  }

  // Puntuación de calidad de una detección [0..1+]
  function _computeQuality(det, frameCanvas, frameW, frameH) {
    const [x, y, w, h] = det.bbox;

    // 1. Tamaño relativo (señal más grande = más cerca = mejor)
    const areaRatio = (w * h) / (frameW * frameH);
    const sizeScore = Math.min(areaRatio * 8, 1.0); // saturar

    // 2. Centrado (penalizar señales en los bordes)
    const cx = (x + w/2) / frameW;
    const cy = (y + h/2) / frameH;
    const distCenter = Math.hypot(cx - 0.5, cy - 0.5) / 0.707; // 0=centro, 1=esquina
    const centerScore = 1 - distCenter * 0.5; // máx penalización 50%

    // 3. Nitidez (varianza de Laplaciano sobre el recorte)
    const sharpness = _estimateSharpness(frameCanvas, det.bbox);

    // 4. Confianza del detector
    const confScore = det.score;

    // Combinación ponderada
    // Nitidez con más peso: una señal grande pero movida no sirve para evaluar
    return sizeScore * 0.30 + sharpness * 0.42 + confScore * 0.18 + centerScore * 0.10;
  }

  // Estima nitidez con varianza del Laplaciano sobre una versión reducida del recorte
  function _estimateSharpness(frameCanvas, bbox) {
    try {
      const [x, y, w, h] = bbox.map(Math.round);
      if (w < 8 || h < 8) return 0;

      const S = 32; // analizar a 32×32 para velocidad
      // OPTIMIZACIÓN: reutilizar el canvas de nitidez
      if (!_sharpCanvas) {
        _sharpCanvas = document.createElement('canvas');
        _sharpCanvas.width = S; _sharpCanvas.height = S;
        _sharpCtx = _sharpCanvas.getContext('2d', { willReadFrequently: true });
      }
      const tctx = _sharpCtx;
      tctx.drawImage(frameCanvas,
        Math.max(0, x), Math.max(0, y),
        Math.min(w, frameCanvas.width - x), Math.min(h, frameCanvas.height - y),
        0, 0, S, S);
      const data = tctx.getImageData(0, 0, S, S).data;

      // Convertir a gris
      const gray = new Float32Array(S * S);
      for (let i = 0; i < S*S; i++) {
        gray[i] = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
      }

      // Laplaciano 3×3 y varianza
      let sum = 0, sumSq = 0, n = 0;
      for (let yy = 1; yy < S-1; yy++) {
        for (let xx = 1; xx < S-1; xx++) {
          const i = yy*S + xx;
          const lap = -4*gray[i] + gray[i-1] + gray[i+1] + gray[i-S] + gray[i+S];
          sum += lap; sumSq += lap*lap; n++;
        }
      }
      if (n === 0) return 0;
      const mean = sum / n;
      const variance = sumSq/n - mean*mean;
      // Normalizar: varianzas típicas 0-2000 → 0..1
      return Math.min(variance / 800, 1.0);
    } catch {
      return 0.5; // valor neutro si falla
    }
  }

  // Extrae un recorte de buena resolución (128×128) de la señal
  function _extractCrop(frameCanvas, bbox) {
    const [x, y, w, h] = bbox.map(Math.round);
    const out = document.createElement('canvas');
    out.width = 256; out.height = 256;
    try {
      out.getContext('2d').drawImage(frameCanvas,
        Math.max(0, x), Math.max(0, y),
        Math.min(w, frameCanvas.width - x), Math.min(h, frameCanvas.height - y),
        0, 0, 256, 256);
    } catch {}
    return out;
  }

  // Limpia tracks que llevan mucho sin verse (opcional, para vídeo largo)
  function pruneStale() {
    const now = Date.now();
    // No eliminamos del todo, solo marcamos; mantener todos para evaluación final
    return _tracks.filter(t => (now - t.lastSeen) < TRACK_TTL);
  }

  // Devuelve todas las señales detectadas con su mejor imagen,
  // ordenadas por calidad. Filtra las vistas muy pocas veces (ruido).
  function getBestSigns(minCount = 1) {
    return _tracks
      .filter(t => t.count >= minCount)
      .sort((a, b) => b.bestScore - a.bestScore)
      .map(t => ({
        id: `track_${t.id}`,
        signType: t.signType,
        category: t.category,
        label: t.label,
        classId: t.classId,
        color: t.color,
        bbox: t.bestBbox,
        crop: t.bestCrop,
        confidence: t.confidence,
        qualityScore: t.bestScore,
        isHorizontal: t.isHorizontal,
        timesDetected: t.count,
        gps: t.gps,
        ts: t.firstSeen,
      }));
  }

  function getActiveCount() { return _tracks.length; }

  return { reset, update, pruneStale, getBestSigns, getActiveCount };
})();
