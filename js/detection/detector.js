'use strict';
const Detector = (() => {
  let _running = false, _loopId = null;
  let _fps = 0, _fcount = 0, _fts = 0;
  let _offscreen = null; // canvas offscreen para análisis

  async function init(onProgress) {
    await ObjectDetector.load(onProgress);
  }

  // Detecta señales en un canvas estático (modo foto)
  function detectFrame(canvas) {
    if (!ObjectDetector.isReady() || !canvas || !canvas.width) return [];
    try {
      return _processFrame(canvas);
    } catch(e) {
      console.warn('[Detector] detectFrame error:', e);
      return [];
    }
  }

  function _processFrame(canvas) {
    const rawPreds = ObjectDetector.detect(canvas);
    const results = [];
    for (const pred of rawPreds) {
      const [x,y,w,h] = pred.bbox;
      const crop = ImageUtils.cropToCanvas(canvas, [x,y,w,h], 96);
      const { signType, category, confidence } = SignDetector.classifyFromColorDetection(pred, crop);
      results.push({
        id: `d${Date.now()}${Math.random().toString(36).slice(2,4)}`,
        signType, category, confidence,
        bbox: pred.bbox,
        sourceW: canvas.width,
        sourceH: canvas.height,
        dominantColor: pred.color,
        isHorizontal: false,
        crop,
        ts: Date.now(),
        gps: Geo.getPos(),
      });
    }
    return SignDetector.nms(results);
  }

  // Loop de detección sobre vídeo en tiempo real
  function startLoop(videoEl, onDetections) {
    stopLoop(); // siempre parar el anterior si existe
    _running = true;
    _fts = performance.now();
    _fcount = 0;

    // Canvas offscreen reutilizable
    if (!_offscreen) _offscreen = document.createElement('canvas');

    const INTERVAL = 200; // ~5 fps de análisis (no sobrecargar móvil)

    function loop() {
      if (!_running) return;

      try {
        if (videoEl.readyState >= 2 && !videoEl.paused && videoEl.videoWidth > 0) {
          const vW = videoEl.videoWidth;
          const vH = videoEl.videoHeight;

          if (_offscreen.width !== vW || _offscreen.height !== vH) {
            _offscreen.width  = vW;
            _offscreen.height = vH;
          }
          _offscreen.getContext('2d').drawImage(videoEl, 0, 0, vW, vH);

          const dets = _processFrame(_offscreen);
          onDetections(dets); // SIEMPRE notificar (vacío o no)

          // FPS
          _fcount++;
          const now = performance.now();
          if (now - _fts >= 1000) {
            _fps = Math.round(_fcount * 1000 / (now - _fts));
            _fcount = 0; _fts = now;
          }
        }
      } catch(e) {
        console.warn('[Detector] loop error:', e);
      }

      _loopId = setTimeout(loop, INTERVAL);
    }

    _loopId = setTimeout(loop, 600); // espera inicial: vídeo necesita tiempo para arrancar
  }

  function stopLoop() {
    _running = false;
    if (_loopId) { clearTimeout(_loopId); _loopId = null; }
  }

  function getFPS()  { return _fps; }
  function isReady() { return ObjectDetector.isReady(); }

  return { init, detectFrame, startLoop, stopLoop, getFPS, isReady };
})();
