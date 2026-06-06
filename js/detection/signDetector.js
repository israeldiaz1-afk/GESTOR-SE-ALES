'use strict';
/* ══════════════════════════════════════════════
   SIGNDETECTOR.JS — Clasificador de señales verticales
   Combina detección COCO + análisis de color/forma
   para clasificar señales de tráfico españolas
   ══════════════════════════════════════════════ */
const SignDetector = (() => {

  // Clasifica una predicción COCO + crop de canvas → tipo de señal DGT
  function classify(cocoPrediction, cropCanvas) {
    const cocoClass = cocoPrediction?.class || '';
    let signType = 'UNKNOWN';
    let confidence = cocoPrediction?.score || 0.5;
    let category = 'desconocido';

    // 1. Mapeo directo desde clase COCO
    if (COCO_TO_SIGN[cocoClass]) {
      signType = COCO_TO_SIGN[cocoClass];
      category = SIGN_CATALOG[signType]?.category || 'desconocido';
      confidence = Math.min(confidence + 0.1, 0.99); // boost para clases directas
      return { signType, category, confidence };
    }

    // 2. Sin clase COCO directa → análisis de color/forma del crop
    if (cropCanvas) {
      const analysis = _analyzeSignCrop(cropCanvas);
      signType   = analysis.signType;
      category   = analysis.category;
      confidence = analysis.confidence;
    }

    return { signType, category, confidence };
  }

  // Analiza un crop de señal para inferir tipo por color y forma
  function _analyzeSignCrop(canvas) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, w, h).data;

    // Análisis de color dominante
    let rCount=0, gCount=0, bCount=0, yCount=0, wCount=0, total=0;
    for (let i=0; i<data.length; i+=4) {
      const r=data[i], g=data[i+1], b=data[i+2];
      total++;
      if (r>160 && g<80  && b<80)  rCount++; // rojo
      if (b>120 && r<100 && g<130) bCount++; // azul
      if (r>180 && g>150 && b<80)  yCount++; // amarillo
      if (r>180 && g>180 && b>180) wCount++; // blanco
      if (g>130 && r<100 && b<100) gCount++; // verde
    }

    const rRatio = rCount/total, bRatio = bCount/total;
    const yRatio = yCount/total, wRatio = wCount/total;

    // Forma: ratio aspecto
    const aspectRatio = w / h;
    const isCircular  = aspectRatio > 0.8 && aspectRatio < 1.2;
    const isTriangle  = aspectRatio > 0.9 && aspectRatio < 1.3; // aproximado
    const isRect      = aspectRatio > 1.4 || aspectRatio < 0.6;

    // Lógica de clasificación
    if (rRatio > 0.25) {
      if (isCircular) return { signType: 'R2',   category: 'prioridad',   confidence: 0.60 }; // STOP genérico
      if (isTriangle) return { signType: 'R1',   category: 'prioridad',   confidence: 0.55 }; // Ceda el paso
      if (rRatio > 0.35) return { signType: 'R203', category: 'velocidad', confidence: 0.50 }; // Velocidad genérico
    }
    if (bRatio > 0.25) {
      if (isCircular) return { signType: 'M501', category: 'obligacion',  confidence: 0.55 };
      return { signType: 'S1', category: 'informacion', confidence: 0.50 };
    }
    if (yRatio > 0.20) {
      return { signType: 'P18', category: 'peligro', confidence: 0.52 };
    }
    if (wRatio > 0.40 && rRatio < 0.1) {
      return { signType: 'R301', category: 'velocidad', confidence: 0.48 };
    }

    return { signType: 'UNKNOWN', category: 'desconocido', confidence: 0.40 };
  }

  // Filtra predicciones COCO relevantes para señalización
  function filterRelevant(predictions, canvasW, canvasH) {
    return predictions.filter(p => {
      const [x, y, w, h] = p.bbox;
      // Tamaño mínimo
      if (w < APP_CONFIG.detection.minSignPixels || h < APP_CONFIG.detection.minSignPixels) return false;
      // Aspect ratio (señales verticales no son muy horizontales)
      const aspect = w / h;
      // Clases COCO que interesan
      const goodClass = APP_CONFIG.cocoSignClasses.includes(p.class);
      // O cualquier objeto de tamaño razonable con buen score
      const goodScore = p.score >= APP_CONFIG.detection.cocoConfidence;
      return goodScore && (goodClass || (aspect > 0.3 && aspect < 3));
    });
  }

  // Aplica Non-Maximum Suppression manual
  function nms(detections) {
    if (detections.length <= 1) return detections;
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept = [];
    for (const det of sorted) {
      const overlap = kept.some(k => _iou(det.bbox, k.bbox) > APP_CONFIG.detection.nmsThreshold);
      if (!overlap) kept.push(det);
    }
    return kept;
  }

  function _iou([ax, ay, aw, ah], [bx, by, bw, bh]) {
    const ix = Math.max(0, Math.min(ax+aw, bx+bw) - Math.max(ax, bx));
    const iy = Math.max(0, Math.min(ay+ah, by+bh) - Math.max(ay, by));
    const inter = ix * iy;
    const union = aw*ah + bw*bh - inter;
    return union > 0 ? inter / union : 0;
  }

  return { classify, filterRelevant, nms };
})();
