'use strict';
const Detector = (() => {
  let _running=false, _loopId=null, _fps=0, _fcount=0, _fts=0;
  // Canvas interno para análisis (nunca se muestra)
  let _offscreen = null;

  async function init(onProgress) {
    await ObjectDetector.load(onProgress);
  }

  function detectFrame(sourceCanvas) {
    if (!ObjectDetector.isReady() || !sourceCanvas || !sourceCanvas.width) return [];
    try {
      const rawPreds = ObjectDetector.detect(sourceCanvas);
      const results = [];
      for (const pred of rawPreds) {
        const [x,y,w,h] = pred.bbox;
        const crop = ImageUtils.cropToCanvas(sourceCanvas, [x,y,w,h], 96);
        const { signType, category, confidence } = SignDetector.classifyFromColorDetection(pred, crop);
        results.push({
          id: `det_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          signType, category, confidence,
          bbox: pred.bbox,
          dominantColor: pred.color,
          isHorizontal: false,
          crop,
          ts: Date.now(),
          gps: Geo.getPos(),
        });
      }
      return SignDetector.nms(results);
    } catch(e) {
      Logger.warn('detectFrame:', e);
      return [];
    }
  }

  // BUG2+4 FIX: canvas offscreen para análisis, overlay independiente,
  // siempre llamar onDetections (incluso con array vacío para limpiar UI)
  function startLoop(videoEl, overlayCanvas, onDetections) {
    _running = true;
    _fts = performance.now();
    _fcount = 0;

    // Canvas offscreen de análisis (mismo tamaño que el vídeo)
    if (!_offscreen) _offscreen = document.createElement('canvas');

    const INTERVAL = Math.round(1000 / 5); // 5 fps de análisis

    const loop = () => {
      if (!_running) return;

      if (videoEl.readyState >= 2 && !videoEl.paused && videoEl.videoWidth > 0) {
        const vW = videoEl.videoWidth;
        const vH = videoEl.videoHeight;

        // Dibujar frame en canvas offscreen para análisis
        _offscreen.width  = vW;
        _offscreen.height = vH;
        _offscreen.getContext('2d').drawImage(videoEl, 0, 0, vW, vH);

        // Detectar sobre el offscreen
        const dets = detectFrame(_offscreen);

        // Siempre notificar (incluso [] para limpiar recuadros viejos)
        onDetections(dets);

        // FPS
        _fcount++;
        const now = performance.now();
        if (now - _fts >= 1000) {
          _fps = Math.round(_fcount * 1000 / (now - _fts));
          _fcount = 0;
          _fts = now;
        }
      }

      _loopId = setTimeout(loop, INTERVAL);
    };

    _loopId = setTimeout(loop, 500); // esperar 500ms inicial para que el vídeo arranque
  }

  function stopLoop() {
    _running = false;
    if (_loopId) { clearTimeout(_loopId); _loopId = null; }
  }

  function getFPS()  { return _fps; }
  function isReady() { return ObjectDetector.isReady(); }

  return { init, detectFrame, startLoop, stopLoop, getFPS, isReady };
})();
