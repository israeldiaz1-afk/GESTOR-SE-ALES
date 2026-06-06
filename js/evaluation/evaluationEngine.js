'use strict';
/* ══════════════════════════════════════════════════
   EVALUATIONENGINE.JS — Motor principal de propuestas
   Genera valoraciones para los 9 parámetros a partir
   de análisis de imagen (canvas) + contexto de detección
   ══════════════════════════════════════════════════ */
const EvaluationEngine = (() => {

  // Propone valores para los 9 parámetros dado un objeto de detección
  function propose(detection, sourceCanvas) {
    const { signType, category, bbox, confidence, dominantColor } = detection;
    const [x, y, w, h] = bbox;

    // Análisis de imagen si tenemos canvas
    const imgMetrics = sourceCanvas ? _analyzeImage(sourceCanvas, x, y, w, h) : {};

    // Propuestas base según tipo/categoría
    const base = _baseProposals(signType, category, confidence);

    // Ajustes por métricas de imagen
    const withImg = _applyImageMetrics(base, imgMetrics);

    // Aplicar aprendizaje acumulado
    const final = Learning.adjustAll(signType, withImg);

    // Calcular rating
    const rating = calcRating(final);

    return {
      values: final,
      rating,
      confidence: Math.round(confidence * 100),
      source: 'ai',
      metrics: imgMetrics,
    };
  }

  // ── Propuestas base por categoría de señal ──
  function _baseProposals(signType, category, confidence) {
    // Nivel de confianza normalizado 1-5
    const confLevel = confidence >= 0.9 ? 5
                    : confidence >= 0.75 ? 4
                    : confidence >= 0.6  ? 3
                    : confidence >= 0.45 ? 2 : 1;

    // Base optimista: asumimos señal en buen estado si se detecta bien
    const proposals = {
      visibilidad:        Math.min(5, confLevel + 1),
      retroreflectancia:  3,
      legibilidad:        confLevel >= 3 ? 4 : 3,
      estado_fisico:      4,
      color_contraste:    confLevel >= 3 ? 4 : 3,
      posicionamiento:    3,
      cumplimiento_norma: 3,
      limpieza:           4,
      soporte:            4,
    };

    // Ajustes específicos por categoría
    if (category === 'horizontal') {
      proposals.soporte = 5; // Marcas viales no tienen poste
      proposals.posicionamiento = 4;
    }
    if (category === 'peligro') {
      proposals.cumplimiento_norma = 4; // Si se detecta bien, probablemente está bien ubicada
    }
    if (signType === 'UNKNOWN') {
      // Señal no identificada: penalizar legibilidad
      proposals.legibilidad = 2;
      proposals.cumplimiento_norma = 2;
    }

    return proposals;
  }

  // ── Ajustes por métricas de imagen real ──
  function _applyImageMetrics(base, metrics) {
    const result = { ...base };

    if (metrics.bboxAreaRatio !== undefined) {
      // Señal muy pequeña → menor visibilidad
      if (metrics.bboxAreaRatio < 0.005) result.visibilidad = Math.max(1, result.visibilidad - 1);
      if (metrics.bboxAreaRatio > 0.05)  result.visibilidad = Math.min(5, result.visibilidad + 1);
    }

    if (metrics.saturation !== undefined) {
      // Saturación baja → color/retroreflectancia degradados
      if (metrics.saturation < 0.25) {
        result.retroreflectancia = Math.max(1, result.retroreflectancia - 1);
        result.color_contraste   = Math.max(1, result.color_contraste - 1);
      }
      if (metrics.saturation > 0.6) {
        result.retroreflectancia = Math.min(5, result.retroreflectancia + 1);
        result.color_contraste   = Math.min(5, result.color_contraste + 1);
      }
    }

    if (metrics.edgeVariance !== undefined) {
      // Alta varianza de bordes → señal deteriorada o con grafiti
      if (metrics.edgeVariance > 0.4) {
        result.limpieza    = Math.max(1, result.limpieza - 1);
        result.estado_fisico = Math.max(1, result.estado_fisico - 1);
      }
    }

    if (metrics.tiltAngle !== undefined) {
      // Ángulo de inclinación
      if (Math.abs(metrics.tiltAngle) > 15) result.posicionamiento = Math.max(1, result.posicionamiento - 2);
      else if (Math.abs(metrics.tiltAngle) > 8) result.posicionamiento = Math.max(1, result.posicionamiento - 1);
    }

    if (metrics.brightness !== undefined) {
      // Brillo muy bajo → suciedad o zona oscura
      if (metrics.brightness < 0.3) result.limpieza = Math.max(1, result.limpieza - 1);
    }

    return result;
  }

  // ── Análisis de imagen en canvas ──
  function _analyzeImage(canvas, x, y, w, h) {
    try {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(
        Math.max(0, Math.round(x)),
        Math.max(0, Math.round(y)),
        Math.min(Math.round(w), canvas.width - Math.round(x)),
        Math.min(Math.round(h), canvas.height - Math.round(y))
      );
      const data = imgData.data;
      const n = data.length / 4;

      let rSum=0, gSum=0, bSum=0;
      let rMin=255, gMin=255, bMin=255;
      let rMax=0, gMax=0, bMax=0;

      for (let i=0; i<data.length; i+=4) {
        const r=data[i], g=data[i+1], b=data[i+2];
        rSum+=r; gSum+=g; bSum+=b;
        if(r<rMin) rMin=r; if(r>rMax) rMax=r;
        if(g<gMin) gMin=g; if(g>gMax) gMax=g;
        if(b<bMin) bMin=b; if(b>bMax) bMax=b;
      }

      const rMean=rSum/n, gMean=gSum/n, bMean=bSum/n;
      const brightness = (rMean + gMean + bMean) / (3 * 255);

      // Saturación estimada
      const maxC = Math.max(rMean, gMean, bMean);
      const minC = Math.min(rMean, gMean, bMean);
      const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Varianza de bordes (contraste interno)
      const edgeVariance = ((rMax-rMin) + (gMax-gMin) + (bMax-bMin)) / (3 * 255);

      // Área relativa de la bbox respecto al canvas total
      const bboxAreaRatio = (w * h) / (canvas.width * canvas.height);

      return { brightness, saturation, edgeVariance, bboxAreaRatio, rMean, gMean, bMean };
    } catch (e) {
      Logger.warn('ImageAnalysis error:', e);
      return {};
    }
  }

  // ── Registro de validación/corrección del usuario ──
  async function recordValidation(detection, aiValues, userValues, accepted) {
    if (accepted) {
      // Sin correcciones → todos los parámetros marcados como correctos
      for (const param of Object.keys(aiValues)) {
        await Learning.recordCorrection(detection.signType, param, aiValues[param], aiValues[param]);
      }
    } else {
      // Registrar cada parámetro que cambió
      for (const param of Object.keys(userValues)) {
        await Learning.recordCorrection(detection.signType, param, aiValues[param], userValues[param]);
      }
    }
  }

  return { propose, recordValidation };
})();
