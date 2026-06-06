'use strict';
/* ══════════════════════════════════════════════
   LEARNING.JS — Sistema de aprendizaje por corrección
   Ajusta propuestas de la IA basándose en validaciones
   ══════════════════════════════════════════════ */
const Learning = (() => {
  // Ajustes en memoria: { signType: { paramId: ajuste } }
  let _adjustments = {};
  // Número de eventos por (signType, paramId)
  let _counts = {};

  async function load() {
    try {
      const events = await DB.getAllEvents();
      _rebuild(events);
      Logger.info(`Learning: ${events.length} eventos cargados`);
    } catch (e) {
      Logger.warn('Learning: no se pudieron cargar eventos', e);
    }
  }

  function _rebuild(events) {
    _adjustments = {};
    _counts = {};
    // Agrupa y pondera eventos (más recientes tienen más peso)
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    for (const ev of sorted) {
      const key = `${ev.signType}::${ev.param}`;
      if (!_adjustments[key]) { _adjustments[key] = 0; _counts[key] = 0; }
      // Media exponencial suavizada
      const alpha = 0.3;
      _adjustments[key] = _adjustments[key] * (1 - alpha) + ev.delta * alpha;
      _counts[key]++;
    }
  }

  // Registra una corrección del usuario
  async function recordCorrection(signType, param, aiValue, userValue) {
    if (aiValue === userValue) return; // sin diferencia
    const delta = userValue - aiValue;
    const event = { signType, param, aiValue, userValue, delta, ts: Date.now() };
    try {
      await DB.saveEvent(event);
      // Actualizar ajuste en memoria
      const key = `${signType}::${param}`;
      const alpha = 0.3;
      if (!_adjustments[key]) { _adjustments[key] = 0; _counts[key] = 0; }
      _adjustments[key] = _adjustments[key] * (1 - alpha) + delta * alpha;
      _counts[key]++;
      Logger.debug(`Learning: corrección registrada ${signType}/${param}: ${aiValue}→${userValue} (Δ${delta})`);
    } catch (e) {
      Logger.error('Learning: error guardando corrección', e);
    }
  }

  // Aplica ajuste aprendido a un valor propuesto
  function adjust(signType, param, aiValue) {
    const key = `${signType}::${param}`;
    const adj = _adjustments[key] ?? 0;
    const count = _counts[key] ?? 0;
    // Solo aplicar si hay suficientes muestras
    if (count < APP_CONFIG.learning.minSamplesForAdjust) return aiValue;
    const adjusted = aiValue + adj;
    return Math.max(1, Math.min(5, Math.round(adjusted)));
  }

  // Aplica ajustes a un objeto completo de valores
  function adjustAll(signType, values) {
    const result = {};
    for (const [param, val] of Object.entries(values)) {
      result[param] = adjust(signType, param, val);
    }
    return result;
  }

  // Estadísticas de precisión: % de propuestas aceptadas sin cambio
  async function getAccuracy() {
    try {
      const events = await DB.getAllEvents();
      if (events.length === 0) return null;
      const total = events.length;
      const changed = events.filter(e => e.delta !== 0).length;
      return Math.round(((total - changed) / total) * 100);
    } catch { return null; }
  }

  async function reset() {
    await DB.clearLearning();
    _adjustments = {};
    _counts = {};
    Logger.info('Learning: reseteado');
  }

  function getStats() {
    return {
      totalEvents: Object.values(_counts).reduce((a, b) => a + b, 0),
      adjustedParams: Object.keys(_adjustments).filter(k => Math.abs(_adjustments[k]) > 0.1).length,
    };
  }

  return { load, recordCorrection, adjust, adjustAll, getAccuracy, reset, getStats };
})();
