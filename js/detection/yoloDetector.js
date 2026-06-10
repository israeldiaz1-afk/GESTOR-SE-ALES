'use strict';
/* ═══════════════════════════════════════════════════════════
   YOLODETECTOR.JS — Motor de detección neuronal (YOLOv8 + ONNX)
   Corre 100% en el navegador vía ONNX Runtime Web.
   - Carga el modelo desde ./models/model.onnx (si existe)
   - Preprocesado letterbox a 640×640
   - Inferencia ONNX (WebGL → WASM fallback)
   - Post-proceso: decodifica salida [1, N, 8400] + NMS en JS puro
   Si el modelo no está disponible, isAvailable() devuelve false
   y la app usa el detector de color como fallback.
   ═══════════════════════════════════════════════════════════ */
const YoloDetector = (() => {
  let _session = null;
  let _ready = false;
  let _available = false;
  let _inputName = 'images';
  let _inputSize = 640;
  let _numClasses = 0;
  let _labels = [];
  let _backend = 'none';

  // OPTIMIZACIÓN: canvas y buffer reutilizables (evita crear miles por minuto)
  let _ppCanvas = null;   // canvas de preprocesado (reutilizado)
  let _ppCtx = null;
  let _floatBuf = null;   // buffer Float32 del tensor (reutilizado)
  let _diagDone = false;  // diagnóstico de salida (solo una vez)
  let _diagCount = 0;     // diagnóstico de conteo

  // Ruta del modelo dentro del repo (el usuario sube su model.onnx aquí)
  const MODEL_URL = './models/model.onnx';
  const LABELS_URL = './models/labels.json';
  // CDN de ONNX Runtime Web
  const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';

  // Carga ONNX Runtime Web desde CDN (solo una vez)
  function _loadORT() {
    return new Promise((resolve, reject) => {
      if (window.ort) return resolve(window.ort);
      const script = document.createElement('script');
      script.src = ORT_CDN;
      script.onload = () => {
        if (window.ort) {
          // Configurar rutas de los binarios WASM
          window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
          // ESTABILIDAD MÓVIL: limitar hilos WASM (evita saturar CPU/memoria)
          // Usar como mucho 2 hilos para no tumbar el dispositivo
          const cores = (navigator.hardwareConcurrency || 4);
          window.ort.env.wasm.numThreads = Math.min(2, Math.max(1, cores - 2));
          window.ort.env.wasm.simd = true;
          resolve(window.ort);
        } else {
          reject(new Error('ONNX Runtime no se cargó'));
        }
      };
      script.onerror = () => reject(new Error('No se pudo descargar ONNX Runtime'));
      document.head.appendChild(script);
    });
  }

  // Comprueba si el modelo existe en el servidor (HEAD request)
  async function _modelExists() {
    try {
      const res = await fetch(MODEL_URL, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function load(onProgress) {
    onProgress?.('Comprobando modelo IA…', 10);

    // 1. ¿Existe el modelo?
    const exists = await _modelExists();
    if (!exists) {
      _available = false;
      _ready = true; // "listo" pero sin modelo → fallback a color
      onProgress?.('Modelo IA no instalado (modo color)', 100);
      return;
    }

    try {
      // 2. Cargar ONNX Runtime Web
      onProgress?.('Descargando motor IA…', 30);
      const ort = await _loadORT();

      // 3. Cargar etiquetas (opcional)
      onProgress?.('Cargando clases…', 45);
      try {
        const lblRes = await fetch(LABELS_URL);
        if (lblRes.ok) _labels = await lblRes.json();
      } catch {}

      // 4. Crear sesión de inferencia
      // ESTABILIDAD: usar SOLO WASM. El backend WebGL de onnxruntime-web es
      // inestable con modelos grandes y puede agotar la memoria GPU del móvil
      // (causando cuelgues e incluso reinicios del dispositivo).
      onProgress?.('Inicializando red neuronal…', 60);
      _session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: false,   // menos consumo de memoria
        enableMemPattern: false,
        executionMode: 'sequential',
      });
      _backend = 'wasm';

      _inputName = _session.inputNames[0] || 'images';

      onProgress?.('Modelo IA listo ✓', 100);
      _available = true;
      _ready = true;
      Logger.info(`YOLO cargado (${_backend}), input: ${_inputName}`);
    } catch (e) {
      Logger.error('YOLO load error:', e);
      _available = false;
      _ready = true; // fallback a color
      onProgress?.('Error IA — usando modo color', 100);
    }
  }

  // Preprocesado: letterbox a 640×640 manteniendo aspect ratio
  function _preprocess(sourceCanvas) {
    const S = _inputSize;
    const srcW = sourceCanvas.width, srcH = sourceCanvas.height;

    // Escala letterbox
    const scale = Math.min(S / srcW, S / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = Math.floor((S - newW) / 2);
    const padY = Math.floor((S - newH) / 2);

    // OPTIMIZACIÓN: reutilizar canvas en vez de crear uno nuevo cada frame
    if (!_ppCanvas) {
      _ppCanvas = document.createElement('canvas');
      _ppCanvas.width = S; _ppCanvas.height = S;
      _ppCtx = _ppCanvas.getContext('2d', { willReadFrequently: true });
    }
    const tctx = _ppCtx;
    tctx.fillStyle = 'rgb(114,114,114)';
    tctx.fillRect(0, 0, S, S);
    tctx.drawImage(sourceCanvas, 0, 0, srcW, srcH, padX, padY, newW, newH);

    const imgData = tctx.getImageData(0, 0, S, S).data;

    // OPTIMIZACIÓN: reutilizar el buffer Float32
    const area = S * S;
    if (!_floatBuf || _floatBuf.length !== area * 3) {
      _floatBuf = new Float32Array(area * 3);
    }
    const float = _floatBuf;
    for (let i = 0; i < area; i++) {
      float[i]          = imgData[i*4]     / 255; // R
      float[i + area]   = imgData[i*4 + 1] / 255; // G
      float[i + area*2] = imgData[i*4 + 2] / 255; // B
    }

    return { tensor: float, scale, padX, padY, S };
  }

  // Detecta señales en un canvas. Devuelve [{bbox, score, classId, color, ...}]
  async function detect(sourceCanvas, scoreThreshold = 0.35, iouThreshold = 0.45) {
    if (!_available || !_session || !sourceCanvas || !sourceCanvas.width) return [];

    const ort = window.ort;
    if (!ort) return [];

    try {
      const { tensor, scale, padX, padY, S } = _preprocess(sourceCanvas);
      const inputTensor = new ort.Tensor('float32', tensor, [1, 3, S, S]);

      const feeds = {};
      feeds[_inputName] = inputTensor;
      const output = await _session.run(feeds);
      const outName = _session.outputNames[0];
      const data = output[outName].data;
      const dims = output[outName].dims; // típicamente [1, 4+nc, 8400]

      // DIAGNÓSTICO: registrar forma de salida y score máximo (solo 1ª vez)
      if (!_diagDone) {
        _diagDone = true;
        let gmax = 0;
        const ch = dims[1], an = dims[2], ncls = ch - 4;
        for (let a = 0; a < an; a++) {
          for (let c = 0; c < ncls; c++) {
            const s = data[(4 + c) * an + a];
            if (s > gmax) gmax = s;
          }
        }
        console.log('[YOLO diag] salida dims:', JSON.stringify(dims),
                    '| score máximo en frame:', gmax.toFixed(3),
                    '| nº clases:', ncls, '| labels cargadas:', _labels.length);
      }

      const detections = _decodeOutput(data, dims, scale, padX, padY, scoreThreshold);
      const final = _nms(detections, iouThreshold);
      if (!_diagCount || _diagCount < 3) {
        _diagCount = (_diagCount || 0) + 1;
        console.log('[YOLO diag2] tras umbral:', detections.length,
                    '| tras NMS:', final.length,
                    (final[0] ? `| 1ª: ${final[0].label} score ${final[0].score.toFixed(2)} bbox [${final[0].bbox.map(n=>Math.round(n)).join(',')}]` : ''));
      }
      return final;
    } catch (e) {
      Logger.warn('YOLO detect error:', e);
      return [];
    }
  }

  // Decodifica la salida de YOLOv8: [1, 4+nc, 8400]
  // Filas 0-3 = cx,cy,w,h | filas 4..4+nc = scores por clase
  function _decodeOutput(data, dims, scale, padX, padY, scoreThreshold) {
    const results = [];
    // dims = [1, channels, anchors]
    const channels = dims[1];
    const anchors  = dims[2];
    const nc = channels - 4; // número de clases
    _numClasses = nc;

    for (let a = 0; a < anchors; a++) {
      // Encontrar la clase con mayor score para este anchor
      let maxScore = 0, maxClass = -1;
      for (let c = 0; c < nc; c++) {
        const score = data[(4 + c) * anchors + a];
        if (score > maxScore) { maxScore = score; maxClass = c; }
      }

      if (maxScore < scoreThreshold) continue;

      // Coordenadas (en espacio 640×640 con letterbox)
      const cx = data[0 * anchors + a];
      const cy = data[1 * anchors + a];
      const w  = data[2 * anchors + a];
      const h  = data[3 * anchors + a];

      // Deshacer letterbox → coordenadas en imagen original
      const x = (cx - w/2 - padX) / scale;
      const y = (cy - h/2 - padY) / scale;
      const bw = w / scale;
      const bh = h / scale;

      results.push({
        bbox: [x, y, bw, bh],
        score: maxScore,
        classId: maxClass,
        label: _labels[maxClass] || `class_${maxClass}`,
      });
    }

    return results;
  }

  // Non-Maximum Suppression en JS puro
  function _nms(dets, iouThreshold) {
    const sorted = [...dets].sort((a, b) => b.score - a.score);
    const kept = [];
    const active = new Array(sorted.length).fill(true);

    for (let i = 0; i < sorted.length; i++) {
      if (!active[i]) continue;
      kept.push(sorted[i]);
      if (kept.length >= 20) break; // máximo razonable
      for (let j = i + 1; j < sorted.length; j++) {
        if (!active[j]) continue;
        if (_iou(sorted[i].bbox, sorted[j].bbox) > iouThreshold) {
          active[j] = false;
        }
      }
    }
    return kept;
  }

  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]) {
    const ix = Math.max(0, Math.min(ax+aw,bx+bw) - Math.max(ax,bx));
    const iy = Math.max(0, Math.min(ay+ah,by+bh) - Math.max(ay,by));
    const inter = ix*iy;
    const union = aw*ah + bw*bh - inter;
    return union > 0 ? inter/union : 0;
  }

  function isReady()     { return _ready; }
  function isAvailable() { return _available; }
  function getBackend()  { return _backend; }
  function getLabels()   { return _labels; }

  return { load, detect, isReady, isAvailable, getBackend, getLabels };
})();
