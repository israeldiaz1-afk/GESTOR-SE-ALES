'use strict';
/* ══════════════════════════════════════════════════════
   APP.JS — Orquestador principal de RoadSign Evaluator
   Inicialización, event listeners, lógica de sesión
   ══════════════════════════════════════════════════════ */

// ── Toast helper global ──
const Toast = {
  show(msg, type = 'info', duration = 2800) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), duration + 300);
  },
};

// ── Estado global de la app ──
const AppState = {
  initialized: false,
  aiReady: false,
  videoSessionActive: false,
  currentPhotoCanvas: null,
  currentPhotoDetections: [],
};

/* ════════════════════════════════════════
   BOOT SEQUENCE
   ════════════════════════════════════════ */
async function boot() {
  Screens.init();

  const progressEl = document.getElementById('splash-progress');
  const statusEl   = document.getElementById('splash-status');

  const setProgress = (pct, msg) => {
    progressEl.style.width = pct + '%';
    statusEl.textContent = msg;
  };

  try {
    setProgress(10, 'Inicializando base de datos…');
    await DB.init();

    setProgress(25, 'Cargando perfil…');
    await _loadUserProfile();

    setProgress(35, 'Iniciando sistema de aprendizaje…');
    await Learning.load();

    setProgress(50, 'Cargando modelos IA (puede tardar)…');
    await Detector.init((msg, pct) => setProgress(pct, msg));

    setProgress(90, 'Iniciando GPS…');
    Geo.start().catch(() => {}); // GPS opcional

    setProgress(100, '¡Listo!');
    AppState.initialized = true;
    AppState.aiReady = true;

    await new Promise(r => setTimeout(r, 600));

    // ¿Primer uso?
    const firstUse = await DB.getProfile('onboarded');
    if (!firstUse) {
      Screens.show('onboarding', false);
    } else {
      Screens.show('home', false);
      _refreshHome();
    }

    _updateAIStatus(true);
  } catch (err) {
    Logger.error('Boot error:', err);
    setProgress(100, '⚠ Error de inicio');
    _updateAIStatus(false, err.message);
    await new Promise(r => setTimeout(r, 1200));
    Screens.show('home', false);
    _refreshHome();
  }

  _bindAllEvents();
}

/* ════════════════════════════════════════
   PERFIL / HOME
   ════════════════════════════════════════ */
async function _loadUserProfile() {
  const name  = await DB.getProfile('userName') || 'Inspector';
  const email = await DB.getProfile('userEmail') || '';
  document.getElementById('home-username').textContent      = name;
  document.getElementById('settings-name').value            = name;
  document.getElementById('settings-email').value           = email;
  document.getElementById('onboard-name').placeholder       = 'Tu nombre o identificador';
}

async function _refreshHome() {
  const name = await DB.getProfile('userName') || 'Inspector';
  document.getElementById('home-username').textContent = name;

  const total = await DB.countEvaluations();
  const today = (await DB.getTodayEvaluations()).length;
  const acc   = await Learning.getAccuracy();

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-today').textContent    = today;
  document.getElementById('stat-accuracy').textContent = acc !== null ? `${acc}%` : '—';

  _renderRecentList();
  _updateStorageInfo();
}

async function _renderRecentList() {
  const all  = await DB.getAllEvaluations();
  const recent = all.sort((a,b) => b.ts - a.ts).slice(0, 6);
  const list = document.getElementById('recent-list');

  if (recent.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay evaluaciones todavía.</p>';
    return;
  }

  list.innerHTML = recent.map(r => {
    const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG['UNKNOWN'];
    const rating = r.finalRating ?? r.aiRating ?? 0;
    const d      = new Date(r.ts);
    return `<div class="eval-card">
      <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
      <div class="eval-card-body">
        <div class="eval-card-title">${info.label || r.signType}</div>
        <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} · ${d.toLocaleTimeString('es-ES',{timeStyle:'short'})} · ${r.status}</div>
      </div>
      <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
    </div>`;
  }).join('');
}

function _updateAIStatus(ready, errMsg = '') {
  const dot   = document.getElementById('ai-dot');
  const text  = document.getElementById('ai-status-text');
  dot.className = `ai-dot ${ready ? 'ready' : 'error'}`;
  text.textContent = ready ? 'IA lista — COCO-SSD + Clasificador activos' : `IA no disponible: ${errMsg}`;
}

/* ════════════════════════════════════════
   MODO VÍDEO
   ════════════════════════════════════════ */
async function _startVideoMode() {
  if (!AppState.aiReady) { Toast.show('La IA aún se está cargando…', 'warning'); return; }

  Screens.show('video');
  DetectionUI.clearAccumulated();

  const videoEl  = document.getElementById('video-feed');
  const canvasEl = document.getElementById('detection-canvas');
  const countEl  = document.getElementById('video-detection-count');
  const evalBtn  = document.getElementById('btn-video-evaluate');
  const countBadge = document.getElementById('evaluate-count-badge');
  const fpsEl    = document.getElementById('fps-counter');

  try {
    await Camera.start(videoEl);
  } catch (e) {
    Toast.show(e.message, 'error');
    Screens.back();
    return;
  }

  AppState.videoSessionActive = true;

  // GPS
  Geo.onUpdate(pos => {
    document.getElementById('gps-text').textContent = Geo.formatCoords(pos);
  });
  const pos = Geo.getPos();
  if (pos) document.getElementById('gps-text').textContent = Geo.formatCoords(pos);

  // Loop de detección
  Detector.startLoop(videoEl, canvasEl, detections => {
    const all = DetectionUI.accumulate(detections);

    // Dibujar en canvas overlay
    // Escalar coordenadas bbox del vídeo al canvas de display
    const scaleX = canvasEl.width  / videoEl.videoWidth  || 1;
    const scaleY = canvasEl.height / videoEl.videoHeight || 1;
    const scaled = all.map(d => ({
      ...d,
      bbox: [d.bbox[0]*scaleX, d.bbox[1]*scaleY, d.bbox[2]*scaleX, d.bbox[3]*scaleY],
    }));
    DetectionUI.drawDetections(canvasEl, scaled);

    countEl.textContent = all.length;
    countBadge.textContent = all.length;
    evalBtn.disabled = all.length === 0;

    // FPS
    fpsEl.textContent = `${Detector.getFPS()} fps`;
  });

  // Pause/play
  let paused = false;
  document.getElementById('btn-video-pause').onclick = () => {
    paused = !paused;
    document.getElementById('icon-pause').style.display = paused ? 'none' : 'block';
    document.getElementById('icon-play').style.display  = paused ? 'block' : 'none';
    if (paused) Detector.stopLoop();
    else Detector.startLoop(videoEl, canvasEl, arguments.callee);
  };
}

function _stopVideoMode() {
  Detector.stopLoop();
  Camera.stop();
  AppState.videoSessionActive = false;
  document.getElementById('video-feed').srcObject = null;
  const canvas = document.getElementById('detection-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function _startEvaluationFromVideo() {
  const dets = DetectionUI.getAccumulated();
  if (dets.length === 0) { Toast.show('No hay señales detectadas', 'warning'); return; }
  Detector.stopLoop();
  // Tomar snapshot del video como referencia
  const v = document.getElementById('video-feed');
  const snap = document.createElement('canvas');
  snap.width = v.videoWidth; snap.height = v.videoHeight;
  snap.getContext('2d').drawImage(v, 0, 0);
  EvaluationUI.startSession(dets, snap, 'video');
}

/* ════════════════════════════════════════
   MODO FOTO
   ════════════════════════════════════════ */
async function _handlePhotoFile(file) {
  if (!file) return;
  if (!AppState.aiReady) { Toast.show('La IA aún se está cargando…', 'warning'); return; }

  const placeholder = document.getElementById('photo-placeholder');
  const photoCanvas = document.getElementById('photo-canvas');
  const infoEl      = document.getElementById('photo-detection-info');
  const countEl     = document.getElementById('photo-detection-count');
  const evalBtn     = document.getElementById('btn-photo-evaluate');

  placeholder.style.display = 'none';
  photoCanvas.style.display = 'block';
  infoEl.style.display = 'block';
  countEl.textContent = 'Analizando…';

  try {
    const bmp    = await ImageUtils.fileToImageBitmap(file);
    const canvas = ImageUtils.imageBitmapToCanvas(bmp);
    const sized  = ImageUtils.resizeCanvas(canvas, 1280, 960);

    // Render en el canvas visible
    photoCanvas.width  = sized.width;
    photoCanvas.height = sized.height;
    photoCanvas.getContext('2d').drawImage(sized, 0, 0);

    // Detectar
    const detections = await Detector.detectFrame(sized, sized);

    // Dibujar
    DetectionUI.drawOnPhoto(photoCanvas, detections);

    AppState.currentPhotoCanvas     = sized;
    AppState.currentPhotoDetections = detections;

    countEl.textContent = `${detections.length} señal${detections.length !== 1 ? 'es' : ''} detectada${detections.length !== 1 ? 's' : ''}`;
    evalBtn.disabled = detections.length === 0;

    if (detections.length === 0) Toast.show('No se detectaron señales. Prueba con otra imagen.', 'warning');
    else Toast.show(`${detections.length} señal${detections.length !== 1 ? 'es' : ''} detectada${detections.length !== 1 ? 's' : ''}`, 'success');
  } catch (e) {
    Logger.error('Photo analysis error:', e);
    Toast.show('Error al analizar imagen', 'error');
  }
}

function _startEvaluationFromPhoto() {
  if (AppState.currentPhotoDetections.length === 0) return;
  EvaluationUI.startSession(AppState.currentPhotoDetections, AppState.currentPhotoCanvas, 'photo');
}

/* ════════════════════════════════════════
   HISTORIAL
   ════════════════════════════════════════ */
let _historyFilter = 'all';
async function _renderHistory(filter = 'all') {
  _historyFilter = filter;
  const all = (await DB.getAllEvaluations()).sort((a,b) => b.ts - a.ts);
  const filtered = filter === 'all' ? all
    : filter === 'vertical'   ? all.filter(r => !r.isHorizontal)
    : all.filter(r => r.isHorizontal);

  const list = document.getElementById('history-list');
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay evaluaciones en esta categoría.</p>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG['UNKNOWN'];
    const rating = r.finalRating ?? r.aiRating ?? 0;
    const d      = new Date(r.ts);
    return `<div class="eval-card">
      <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
      <div class="eval-card-body">
        <div class="eval-card-title">${info.label || r.signType}</div>
        <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES',{timeStyle:'short'})} · ${r.status} · ${r.isHorizontal?'Horizontal':'Vertical'}</div>
      </div>
      <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   SETTINGS
   ════════════════════════════════════════ */
async function _updateStorageInfo() {
  const { used, quota } = await DB.estimateSize();
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  const usedMB = (used / 1024 / 1024).toFixed(1);
  document.getElementById('storage-fill').style.width  = pct + '%';
  document.getElementById('storage-label').textContent = `${usedMB} MB usados (${pct}%)`;
  const count = await DB.countEvaluations();
  document.getElementById('settings-eval-count').textContent = count;
  const evCount = await DB.countEvents();
  const el = document.getElementById('learning-events-count');
  if (el) el.textContent = evCount;
}

/* ════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════ */
function _bindAllEvents() {

  // ── ONBOARDING ──
  let onboardSlide = 0;
  const onboardSlides = document.querySelectorAll('.onboard-slide');
  const onboardDots   = document.querySelectorAll('.dot');
  const btnNext       = document.getElementById('btn-onboard-next');

  btnNext.onclick = () => {
    onboardSlides[onboardSlide].classList.remove('active');
    onboardDots[onboardSlide].classList.remove('active');
    onboardSlide = Math.min(onboardSlide + 1, onboardSlides.length - 1);
    onboardSlides[onboardSlide].classList.add('active');
    onboardDots[onboardSlide].classList.add('active');
    btnNext.textContent = onboardSlide === onboardSlides.length - 1 ? '' : 'Siguiente';
  };

  document.getElementById('btn-onboard-finish').onclick = async () => {
    const name = document.getElementById('onboard-name').value.trim() || 'Inspector';
    await DB.setProfile('userName', name);
    await DB.setProfile('onboarded', true);
    Screens.show('home', false);
    _refreshHome();
  };

  // ── HOME ──
  document.getElementById('btn-mode-video').onclick    = _startVideoMode;
  document.getElementById('btn-mode-photo').onclick    = () => {
    AppState.currentPhotoCanvas = null;
    AppState.currentPhotoDetections = [];
    document.getElementById('photo-placeholder').style.display = 'flex';
    document.getElementById('photo-canvas').style.display = 'none';
    document.getElementById('photo-detection-info').style.display = 'none';
    document.getElementById('btn-photo-evaluate').disabled = true;
    Screens.show('photo');
  };
  document.getElementById('btn-home-history').onclick  = () => { _renderHistory(); Screens.show('history'); };
  document.getElementById('btn-home-settings').onclick = () => { _updateStorageInfo(); Screens.show('settings'); };

  // ── VÍDEO ──
  document.getElementById('btn-video-back').onclick = () => {
    _stopVideoMode();
    Screens.show('home', false);
    _refreshHome();
  };
  document.getElementById('btn-video-flip').onclick = () => Camera.flip().catch(e => Toast.show(e.message, 'error'));
  document.getElementById('btn-video-evaluate').onclick = _startEvaluationFromVideo;

  // ── FOTO ──
  document.getElementById('btn-photo-back').onclick = () => Screens.show('home', false);
  document.getElementById('btn-photo-gallery').onclick = () => document.getElementById('file-input-gallery').click();
  document.getElementById('btn-photo-camera').onclick  = () => document.getElementById('file-input-camera').click();
  document.getElementById('file-input-gallery').onchange = e => _handlePhotoFile(e.target.files[0]);
  document.getElementById('file-input-camera').onchange  = e => _handlePhotoFile(e.target.files[0]);
  document.getElementById('btn-photo-evaluate').onclick = _startEvaluationFromPhoto;

  // ── EVALUACIÓN ──
  document.getElementById('btn-eval-back').onclick     = () => { Screens.show('home', false); _refreshHome(); };
  document.getElementById('btn-eval-prev').onclick = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex() - 1);
  document.getElementById('btn-eval-next').onclick = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex() + 1);
  document.getElementById('btn-eval-validate').onclick = () => EvaluationUI.validate();
  document.getElementById('btn-eval-reject').onclick   = () => EvaluationUI.reject();
  document.getElementById('btn-eval-edit').onclick     = () => EvaluationUI.openEditor();

  // ── EDITOR ──
  document.getElementById('btn-editor-cancel').onclick = () => Screens.back();
  document.getElementById('btn-editor-save').onclick   = () => EvaluationUI.saveEditor();

  // ── RESUMEN ──
  document.getElementById('btn-summary-export').onclick = () => ExportUI.show();
  document.getElementById('btn-summary-home').onclick   = () => { Screens.show('home', false); _refreshHome(); };

  // ── HISTORIAL ──
  document.getElementById('btn-history-back').onclick   = () => Screens.show('home', false);
  document.getElementById('btn-history-export').onclick = () => ExportUI.show();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderHistory(btn.dataset.filter);
    };
  });

  // ── SETTINGS ──
  document.getElementById('btn-settings-back').onclick = () => Screens.show('home', false);
  document.getElementById('btn-settings-save-profile').onclick = async () => {
    const name  = document.getElementById('settings-name').value.trim() || 'Inspector';
    const email = document.getElementById('settings-email').value.trim();
    await DB.setProfile('userName', name);
    await DB.setProfile('userEmail', email);
    document.getElementById('home-username').textContent = name;
    Toast.show('Perfil guardado', 'success');
  };
  document.getElementById('btn-settings-export').onclick = async () => {
    const format = document.getElementById('export-format').value;
    const range  = document.getElementById('export-range').value;
    await Exporter.exportData(format, range);
  };
  document.getElementById('btn-clear-data').onclick = async () => {
    const n = await DB.deleteOlderThan(90);
    Toast.show(`${n} evaluaciones antiguas eliminadas`, 'success');
    _updateStorageInfo();
  };
  document.getElementById('btn-reset-learning').onclick = async () => {
    await Learning.reset();
    Toast.show('Aprendizaje reiniciado', 'warning');
    _updateStorageInfo();
  };

  // ── MODAL EXPORT ──
  document.getElementById('btn-modal-cancel').onclick   = () => ExportUI.hide();
  document.getElementById('btn-modal-download').onclick = () => ExportUI.doExport();
  document.getElementById('modal-export').onclick = e => { if (e.target === e.currentTarget) ExportUI.hide(); };
}

// ════════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', boot);

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r => Logger.info('SW registrado:', r.scope))
      .catch(e => Logger.warn('SW error:', e));
  });
}
