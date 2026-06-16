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
  let _useFast = false;  // detector rápido de 1 clase disponible
  let _sweepMode = false;
  let _mode = 'idle'; // 'video' | 'photo' | 'idle'
  let _busy = false;  // evita solapar inferencias asíncronas

  async function init(onProgress) {
    // Cargar YOLO de 55 clases (identificador preciso)
    await YoloDetector.load(onProgress);
    _useYolo = YoloDetector.isAvailable();

    // Cargar el detector RÁPIDO de 1 clase (para vídeo)
    await FastDetector.load(onProgress);
    _useFast = FastDetector.isAvailable();

    // Cargar siempre el detector de color como respaldo
    await ObjectDetector.load(() => {});

    Logger.info(`Detector listo. Identificador: ${_useYolo ? 'YOLO 55 clases' : 'color'} | Detector rápido vídeo: ${_useFast ? 'SÍ (nano)' : 'no'}`);
  }

  function getEngine() { return _useYolo ? 'yolo' : 'color'; }
  function hasFastDetector() { return _useFast; }
  function isReady()   { return YoloDetector.isReady() && ObjectDetector.isReady(); }

  // Detección sobre un frame estático (modo foto). Async por YOLO.
  // withCrop=true genera el recorte (necesario en foto/evaluación)
  async function detectFrame(canvas, withCrop = true) {
    if (!canvas || !canvas.width) return [];
    try {
      if (_useYolo) {
        const raw = await YoloDetector.detect(canvas);
        return raw.map(d => {
          const mapped = ClassMapper.map(d);
          return _enrich(mapped, canvas, withCrop);
        });
      } else {
        // Fallback color (síncrono)
        const raw = ObjectDetector.detect(canvas);
        return raw.map(pred => {
          const [x,y,w,h] = pred.bbox;
          const crop = withCrop ? ImageUtils.cropToCanvas(canvas, [x,y,w,h], 96) : null;
          const cls = SignDetector.classifyFromColorDetection(pred, crop || canvas);
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

  // Enriquece una detección YOLO mapeada con crop (opcional), ids, gps
  function _enrich(det, canvas, withCrop = true) {
    const [x,y,w,h] = det.bbox;
    const crop = withCrop ? ImageUtils.cropToCanvas(canvas, [x,y,w,h], 96) : null;
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

  // Detección RÁPIDA para vídeo: localiza señales (sin clasificar).
  // Usa el modelo nano de 1 clase si está; si no, cae al de 55 clases.
  async function detectFast(canvas) {
    if (!canvas || !canvas.width) return [];
    try {
      if (_useFast) {
        const raw = await FastDetector.detect(canvas);
        // Formato uniforme: señal genérica sin tipo (se identifica luego)
        return raw.map(d => ({
          id: `f${Date.now()}${Math.random().toString(36).slice(2,4)}`,
          signType: 'SEÑAL',          // genérico; se identifica al evaluar
          category: 'sin_identificar',
          confidence: d.score,
          score: d.score,
          bbox: d.bbox,
          sourceW: canvas.width, sourceH: canvas.height,
          dominantColor: 'gray', color: '#f5c518',
          isHorizontal: false,
          pendingId: true,            // marca: pendiente de identificar
          ts: Date.now(), gps: Geo.getPos(),
        }));
      }
      // Sin modelo rápido: usar el de 55 clases (más lento pero ya identifica)
      return await detectFrame(canvas, false);
    } catch(e) {
      Logger.warn('detectFast:', e);
      return [];
    }
  }

  // IDENTIFICACIÓN para el procesado: toma las mejores imágenes capturadas
  // y las pasa por el modelo de 55 clases para saber QUÉ señal es cada una.
  // signs: array de getBestSigns() del tracker (cada uno con .crop).
  async function identifySigns(signs) {
    if (!_useYolo) return signs; // sin identificador, devolver tal cual
    const out = [];
    for (const s of signs) {
      let identified = { ...s };
      try {
        if (s.crop && s.crop.width) {
          // Pasar el recorte por el modelo de 55 clases
          const raw = await YoloDetector.detect(s.crop, 0.25, 0.45);
          if (raw.length > 0) {
            // Quedarse con la detección de mayor score
            raw.sort((a,b) => b.score - a.score);
            const mapped = ClassMapper.map(raw[0]);
            identified.signType   = mapped.signType;
            identified.category   = mapped.category;
            identified.color      = mapped.color;
            identified.label      = mapped.label;
            identified.confidence = raw[0].score;
            identified.pendingId  = false;
          }
        }
      } catch(e) { Logger.warn('identify:', e); }
      out.push(identified);
    }
    return out;
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
    const offCtx = _offscreen.getContext('2d', { willReadFrequently: true });

    // OPTIMIZACIÓN: resolución de análisis reducida en móvil.
    // No hace falta procesar el frame a resolución completa de la cámara;
    // 480px de ancho es suficiente para detectar señales y mucho más rápido.
    const ANALYSIS_W = 480;

    // Throttling adaptativo. Con el detector RÁPIDO (nano 480, 1 clase) podemos
    // ir mucho más rápido. Con el de 55 clases (fallback) vamos más lento.
    const fastMode = _useFast;
    let interval = fastMode ? 100 : (_useYolo ? 800 : 200);
    const MIN_INTERVAL = fastMode ? 60 : (_useYolo ? 500 : 150);
    const MAX_INTERVAL = fastMode ? 800 : 2500;
    const REST_AFTER = fastMode ? 30 : (_useYolo ? 250 : 0);

    const loop = async () => {
      if (!_running) return;

      if (!_busy && videoEl.readyState >= 2 && !videoEl.paused && videoEl.videoWidth > 0) {
        _busy = true;
        const t0 = performance.now();
        try {
          const vW = videoEl.videoWidth, vH = videoEl.videoHeight;
          // Dibujar el frame a resolución reducida (mantiene aspect ratio)
          const scale = Math.min(ANALYSIS_W / vW, 1);
          const aW = Math.round(vW * scale);
          const aH = Math.round(vH * scale);
          if (_offscreen.width !== aW || _offscreen.height !== aH) {
            _offscreen.width = aW; _offscreen.height = aH;
          }
          offCtx.drawImage(videoEl, 0, 0, vW, vH, 0, 0, aW, aH);

          // En vídeo usamos el DETECTOR RÁPIDO (solo localiza, no clasifica)
          const dets = await detectFast(_offscreen);

          // Alimentar el tracker (que guarda el mejor recorte solo cuando mejora)
          if (dets.length > 0) {
            SignTracker.update(dets, _offscreen, aW, aH);
          }

          onFrame(dets);

          // FPS
          _fcount++;
          const now = performance.now();
          if (now - _fts >= 1000) {
            _fps = Math.round(_fcount * 1000 / (now - _fts));
            _fcount = 0; _fts = now;
          }

          // Ajuste adaptativo: el intervalo se basa en lo que tardó la inferencia
          // más un descanso fijo, para no encadenar inferencias sin respiro
          const elapsed = performance.now() - t0;
          interval = Math.min(
            Math.max(Math.round(elapsed) + REST_AFTER, MIN_INTERVAL),
            MAX_INTERVAL
          );
        } catch(e) {
          Logger.warn('loop:', e);
        }
        _busy = false;
      }

      _loopId = setTimeout(loop, interval);
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
    init, detectFrame, detectFast, identifySigns, startLoop, stopLoop,
    getBestSigns, getFPS, isReady, getEngine, hasFastDetector,
    setSweepMode: (v) => { _sweepMode = v; },
  };
})();
