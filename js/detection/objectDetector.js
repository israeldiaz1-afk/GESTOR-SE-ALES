'use strict';
/* ══════════════════════════════════════════════
   OBJECTDETECTOR.JS — Wrapper COCO-SSD
   Gestiona carga y predicción del modelo base
   ══════════════════════════════════════════════ */
const ObjectDetector = (() => {
  let _model = null;
  let _loading = false;
  let _ready = false;

  async function load(onProgress) {
    if (_ready) return;
    if (_loading) return new Promise(r => { const t = setInterval(() => { if (_ready) { clearInterval(t); r(); } }, 200); });
    _loading = true;
    try {
      onProgress?.('Cargando COCO-SSD…', 30);
      _model = await cocoSsd.load({ base: 'mobilenet_v2' });
      _ready = true;
      Logger.info('COCO-SSD cargado correctamente');
      onProgress?.('COCO-SSD listo', 60);
    } catch (e) {
      Logger.error('Error cargando COCO-SSD:', e);
      throw e;
    } finally {
      _loading = false;
    }
  }

  async function detect(source) {
    if (!_model) throw new Error('Modelo no cargado');
    const predictions = await _model.detect(source, APP_CONFIG.detection.maxDetectionsPerFrame, APP_CONFIG.detection.cocoConfidence);
    return predictions;
  }

  function isReady() { return _ready; }

  return { load, detect, isReady };
})();
