'use strict';
/* ═══════════════════════════════════════════════════════════
   FASTDETECTOR.JS — Detector RÁPIDO de señales (1 clase)
   Modelo YOLOv8n nano entrenado para localizar señales como
   UNA sola clase ("señal"), sin clasificar el tipo.
   - Entrada 480×480 (más rápido que 640)
   - Solo dice DÓNDE hay señales, no QUÉ son
   - Se usa en VÍDEO para recuadrar rápido y alimentar el tracker
   - La identificación fina la hace YoloDetector (55 clases) después

   Reutiliza ONNX Runtime Web ya cargado (window.ort).
   Si el modelo no existe, isAvailable() = false y el sistema
   cae al YoloDetector de 55 clases para el vídeo también.
   ═══════════════════════════════════════════════════════════ */
const FastDetector = (() => {
  let _session = null;
  let _ready = false;
  let _available = false;
  let _inputName = 'images';
  let _inputSize = 480;   // DEBE coincidir con el imgsz de exportación del modelo.
  // NOTA: el modelo se exportó a 480 fijo. Cambiar esto solo funciona si
  // re-exportas el modelo a esa resolución. Por defecto 480.
  function setInputSize(s) { _inputSize = s; }

  // Canvas y buffer reutilizables (rendimiento)
  let _ppCanvas = null, _ppCtx = null, _floatBuf = null;
  let _diagDone = false;

  const MODEL_URL = './models/model_detector.onnx';

  // Reutiliza ONNX Runtime ya cargado (por YoloDetector). Si no está,
  // espera a que aparezca window.ort (yoloDetector lo carga primero).
  async function _ensureORT() {
    if (window.ort) return window.ort;
    // Esperar hasta 10s a que YoloDetector cargue ORT
    for (let i = 0; i < 100; i++) {
      if (window.ort) return window.ort;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('ONNX Runtime no disponible');
  }

  async function _modelExists() {
    try { const r = await fetch(MODEL_URL, { method: 'HEAD' }); return r.ok; }
    catch { return false; }
  }

  async function load(onProgress) {
    const exists = await _modelExists();
    if (!exists) {
      _available = false; _ready = true;
      Logger.info('FastDetector: modelo no instalado (usará YOLO 55 para vídeo)');
      return;
    }
    try {
      onProgress?.('Cargando detector rápido…', 50);
      const ort = await _ensureORT();
      _session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential',
      });
      _inputName = _session.inputNames[0] || 'images';
      _available = true; _ready = true;
      Logger.info('FastDetector cargado (wasm, 480px, 1 clase)');
    } catch (e) {
      Logger.error('FastDetector load error:', e);
      _available = false; _ready = true;
    }
  }

  // Preprocesado letterbox a 480×480
  function _preprocess(src) {
    const S = _inputSize;
    const srcW = src.width, srcH = src.height;
    const scale = Math.min(S / srcW, S / srcH);
    const newW = Math.round(srcW * scale), newH = Math.round(srcH * scale);
    const padX = Math.floor((S - newW) / 2), padY = Math.floor((S - newH) / 2);

    if (!_ppCanvas) {
      _ppCanvas = document.createElement('canvas');
      _ppCanvas.width = S; _ppCanvas.height = S;
      _ppCtx = _ppCanvas.getContext('2d', { willReadFrequently: true });
    }
    const c = _ppCtx;
    c.fillStyle = 'rgb(114,114,114)';
    c.fillRect(0, 0, S, S);
    c.drawImage(src, 0, 0, srcW, srcH, padX, padY, newW, newH);
    const img = c.getImageData(0, 0, S, S).data;

    const area = S * S;
    if (!_floatBuf || _floatBuf.length !== area * 3) _floatBuf = new Float32Array(area * 3);
    const f = _floatBuf;
    for (let i = 0; i < area; i++) {
      f[i]          = img[i*4]   / 255;
      f[i + area]   = img[i*4+1] / 255;
      f[i + area*2] = img[i*4+2] / 255;
    }
    return { tensor: f, scale, padX, padY, S };
  }

  // Detecta señales (sin clasificar). Devuelve [{bbox, score}]
  async function detect(src, scoreThreshold = 0.30, iouThreshold = 0.45) {
    if (!_available || !_session || !src || !src.width) return [];
    const ort = window.ort;
    if (!ort) return [];
    try {
      const { tensor, scale, padX, padY, S } = _preprocess(src);
      const input = new ort.Tensor('float32', tensor, [1, 3, S, S]);
      const feeds = {}; feeds[_inputName] = input;
      const out = await _session.run(feeds);
      const oname = _session.outputNames[0];
      const data = out[oname].data;
      const dims = out[oname].dims; // [1, 5, N] para 1 clase (4 bbox + 1 score)

      if (!_diagDone) {
        _diagDone = true;
        console.log('[FAST diag] salida dims:', JSON.stringify(dims));
      }

      const dets = _decode(data, dims, scale, padX, padY, scoreThreshold);
      return _nms(dets, iouThreshold);
    } catch (e) {
      Logger.warn('FastDetector detect:', e);
      return [];
    }
  }

  // Decodifica salida [1, 5, N]: filas 0-3 = cx,cy,w,h | fila 4 = score (1 clase)
  function _decode(data, dims, scale, padX, padY, scoreThreshold) {
    const results = [];
    const channels = dims[1];   // 5 (4 bbox + 1 clase)
    const anchors  = dims[2];

    for (let a = 0; a < anchors; a++) {
      // Con 1 sola clase, el score está en la fila 4
      const score = data[4 * anchors + a];
      if (score < scoreThreshold) continue;

      const cx = data[0 * anchors + a];
      const cy = data[1 * anchors + a];
      const w  = data[2 * anchors + a];
      const h  = data[3 * anchors + a];

      const x = (cx - w/2 - padX) / scale;
      const y = (cy - h/2 - padY) / scale;
      results.push({ bbox: [x, y, w/scale, h/scale], score });
    }
    return results;
  }

  function _nms(dets, iouThreshold) {
    const sorted = [...dets].sort((a, b) => b.score - a.score);
    const kept = [];
    const active = new Array(sorted.length).fill(true);
    for (let i = 0; i < sorted.length; i++) {
      if (!active[i]) continue;
      kept.push(sorted[i]);
      if (kept.length >= 30) break;
      for (let j = i + 1; j < sorted.length; j++) {
        if (active[j] && _iou(sorted[i].bbox, sorted[j].bbox) > iouThreshold) active[j] = false;
      }
    }
    return kept;
  }

  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]) {
    const ix = Math.max(0, Math.min(ax+aw,bx+bw) - Math.max(ax,bx));
    const iy = Math.max(0, Math.min(ay+ah,by+bh) - Math.max(ay,by));
    const inter = ix*iy, union = aw*ah + bw*bh - inter;
    return union > 0 ? inter/union : 0;
  }

  function isReady()     { return _ready; }
  function isAvailable() { return _available; }

  return { load, detect, isReady, isAvailable, setInputSize };
})();
