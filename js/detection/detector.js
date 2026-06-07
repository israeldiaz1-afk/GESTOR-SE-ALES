'use strict';
/* ═══════════════════════════════════════════════════════════
   DETECTOR.JS — Orquestador unificado de detección
   - Si YoloDetector está disponible → usa la red neuronal
   - Si no → usa ObjectDetector (color+forma) como fallback
   - En modo vídeo, alimenta el SignTracker para elegir la
     mejor imagen de cada señal durante la grabación
   ═══════════════════════════════════════════════════════════ */
const Detector = (() => {
  let _running = false, _loopId = null;
  let _fps = 0, _fcount = 0, _fts = 0;
  let _offscreen = null;
  let _useYolo = false;
  let _mode = 'idle'; // 'video' | 'photo' | 'idle'
  let _busy = false;  // evita solapar inferencias asíncronas

  async function init(onProgress) {
    // Cargar YOLO (que internamente decide si hay modelo)
    await YoloDetector.load(onProgress);
    _useYolo = YoloDetector.isAvailable();

    // Cargar siempre el detector de color como respaldo
    await ObjectDetector.load(() => {});

    Logger.info(`Detector listo. Motor: ${_useYolo ? 'YOLO neuronal' : 'color (fallback)'}`);
  }

  function getEngine() { return _useYolo ? 'yolo' : 'color'; }
  function isReady()   { return YoloDetector.isReady() && ObjectDetector.isReady(); }

  // Detección sobre un frame estático (modo foto). Async por YOLO.
  async function detectFrame(canvas) {
    if (!canvas || !canvas.width) return [];
    try {
      if (_useYolo) {
        const raw = await YoloDetector.detect(canvas);
        return raw.map(d => {
          const mapped = ClassMapper.map(d);
          return _enrich(mapped, canvas);
        });
      } else {
        // Fallback color (síncrono)
        const raw = ObjectDetector.detect(canvas);
        return raw.map(pred => {
          const [x,y,w,h] = pred.bbox;
          const crop = ImageUtils.cropToCanvas(canvas, [x,y,w,h], 96);
          const cls = SignDetector.classifyFromColorDetection(pred, crop);
          return {
            id: `d${Date.now()}${Math.random().toString(36).slice(2,4)}`,
            ...cls,
            bbox: pred.bbox,
            sourceW: canvas.width, sourceH: canvas.height,
            dominantColor: pred.color, color: pred.color,
            isHorizontal: false, crop,
            score: pred.score, confidence: cls.confidence,
            ts: Date.now(), gps: Geo.getPos(),
          };
        });
      }
    } catch(e) {
      Logger.warn('detectFrame:', e);
      return [];
    }
  }

  // Enriquece una detección YOLO mapeada con crop, ids, gps
  function _enrich(det, canvas) {
    const [x,y,w,h] = det.bbox;
    const crop = ImageUtils.cropToCanvas(canvas, [x,y,w,h], 96);
    return {
      id: `d${Date.now()}${Math.random().toString(36).slice(2,4)}`,
      signType: det.signType,
      category: det.category,
      confidence: det.score,
      score: det.score,
      bbox: det.bbox,
      sourceW: canvas.width,
      sourceH: canvas.height,
      dominantColor: det.color,
      color: det.color,
      classId: det.classId,
      label: det.label,
      isHorizontal: det.category === 'horizontal',
      crop,
      ts: Date.now(),
      gps: Geo.getPos(),
    };
  }

  // Loop de detección en vídeo. onFrame(detections) para dibujar.
  function startLoop(videoEl, onFrame) {
    stopLoop();
    _running = true;
    _mode = 'video';
    _fts = performance.now();
    _fcount = 0;
    SignTracker.reset();

    if (!_offscreen) _offscreen = document.createElement('canvas');

    const INTERVAL = _useYolo ? 120 : 200; // YOLO puede ir más rápido

    const loop = async () => {
      if (!_running) return;

      if (!_busy && videoEl.readyState >= 2 && !videoEl.paused && videoEl.videoWidth > 0) {
        _busy = true;
        try {
          const vW = videoEl.videoWidth, vH = videoEl.videoHeight;
          if (_offscreen.width !== vW || _offscreen.height !== vH) {
            _offscreen.width = vW; _offscreen.height = vH;
          }
          _offscreen.getContext('2d').drawImage(videoEl, 0, 0, vW, vH);

          const dets = await detectFrame(_offscreen);

          // Alimentar el tracker con el frame actual
          if (dets.length > 0) {
            SignTracker.update(dets, _offscreen, vW, vH);
          }

          onFrame(dets);

          // FPS
          _fcount++;
          const now = performance.now();
          if (now - _fts >= 1000) {
            _fps = Math.round(_fcount * 1000 / (now - _fts));
            _fcount = 0; _fts = now;
          }
        } catch(e) {
          Logger.warn('loop:', e);
        }
        _busy = false;
      }

      _loopId = setTimeout(loop, INTERVAL);
    };

    _loopId = setTimeout(loop, 500);
  }

  function stopLoop() {
    _running = false;
    _mode = 'idle';
    if (_loopId) { clearTimeout(_loopId); _loopId = null; }
  }

  // Devuelve las mejores señales capturadas durante el vídeo
  function getBestSigns() {
    return SignTracker.getBestSigns(1);
  }

  function getFPS() { return _fps; }

  return {
    init, detectFrame, startLoop, stopLoop,
    getBestSigns, getFPS, isReady, getEngine,
  };
})();
