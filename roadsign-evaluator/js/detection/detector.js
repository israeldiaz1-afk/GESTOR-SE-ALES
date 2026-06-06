'use strict';
/* ══════════════════════════════════════════════
   DETECTOR.JS — Orquestador principal de detección
   Combina COCO-SSD + SignDetector + MarkingDetector
   ══════════════════════════════════════════════ */
const Detector = (() => {
  let _running = false;
  let _frameCount = 0;
  let _lastFPS = 0;
  let _fpsTs = 0;

  async function init(onProgress) {
    await ObjectDetector.load(onProgress);
    Logger.info('Detector listo');
  }

  // Detecta en un frame de vídeo o canvas estático
  async function detectFrame(source, canvas) {
    if (!ObjectDetector.isReady()) return [];

    let rawPredictions = [];
    try {
      rawPredictions = await ObjectDetector.detect(source);
    } catch (e) {
      Logger.warn('Detección COCO error:', e);
      return [];
    }

    // Filtrar candidatos relevantes
    const filtered = SignDetector.filterRelevant(rawPredictions, canvas.width, canvas.height);

    // Para cada bbox, extraer crop y clasificar
    const detections = [];
    for (const pred of filtered) {
      const [x, y, w, h] = pred.bbox;
      const crop = ImageUtils.cropToCanvas(canvas, [x, y, w, h], 96);
      const { signType, category, confidence } = SignDetector.classify(pred, crop);
      const dominantColor = ImageUtils.getDominantColor(canvas, x, y, w, h);

      detections.push({
        id: `det_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        signType,
        category,
        bbox: pred.bbox,
        confidence,
        dominantColor,
        isHorizontal: false,
        crop, // canvas element
        cocoClass: pred.class,
        ts: Date.now(),
        gps: Geo.getPos(),
      });
    }

    // Marcas horizontales (análisis directo de canvas)
    if (canvas) {
      const markings = MarkingDetector.detect(canvas);
      for (const m of markings) {
        detections.push({
          id: `det_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          ...m,
          crop: ImageUtils.cropToCanvas(canvas, m.bbox, 96),
          ts: Date.now(),
          gps: Geo.getPos(),
        });
      }
    }

    // NMS global
    const final = SignDetector.nms(detections);

    // FPS tracking
    _frameCount++;
    const now = performance.now();
    if (now - _fpsTs >= 1000) {
      _lastFPS = Math.round(_frameCount * 1000 / (now - _fpsTs));
      _frameCount = 0; _fpsTs = now;
    }

    return final;
  }

  // Bucle continuo de detección sobre <video>
  let _loopId = null;
  let _onDetections = null;

  function startLoop(videoEl, canvasEl, onDetections) {
    _onDetections = onDetections;
    _running = true;
    _fpsTs = performance.now();
    const interval = 1000 / APP_CONFIG.detection.videoFPS;

    const loop = async () => {
      if (!_running) return;
      if (videoEl.readyState >= 2 && !videoEl.paused) {
        canvasEl.width  = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(videoEl, 0, 0);
        const dets = await detectFrame(videoEl, canvasEl);
        if (dets.length > 0) _onDetections?.(dets);
      }
      _loopId = setTimeout(loop, interval);
    };

    _loopId = setTimeout(loop, 100);
  }

  function stopLoop() {
    _running = false;
    if (_loopId) clearTimeout(_loopId);
  }

  function getFPS() { return _lastFPS; }
  function isReady() { return ObjectDetector.isReady(); }

  return { init, detectFrame, startLoop, stopLoop, getFPS, isReady };
})();
