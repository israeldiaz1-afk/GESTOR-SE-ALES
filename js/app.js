'use strict';
/* ══════════════════════════════════════════════════════
   APP.JS — RoadSign Evaluator
   FIXES:
   1. Perfil: usa localStorage como fallback robusto + DB
   2. IA modo vídeo: timeout de 90s + fallback sin bloquear
   3. Modo foto: no fuerza cámara nativa, usa galería correctamente
   ══════════════════════════════════════════════════════ */

// ── Toast helper global ──
const Toast = {
  show(msg, type='info', duration=2800) {
    const el=document.createElement('div');
    el.className=`toast ${type}`;
    el.textContent=msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>el.remove(), duration+300);
  },
};

// ── Estado global ──
const AppState = {
  initialized: false,
  aiReady: false,
  aiLoading: false,
  videoSessionActive: false,
  currentPhotoCanvas: null,
  currentPhotoDetections: [],
};

// ── Perfil: localStorage como almacén primario (más fiable en móvil) ──
const Profile = {
  get(key) {
    try { return localStorage.getItem(`rs_${key}`); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(`rs_${key}`, value); return true; } catch { return false; }
  },
  // Intentar también persistir en IndexedDB de forma asíncrona
  async syncToDB(key, value) {
    try { await DB.setProfile(key, value); } catch {}
  },
  async load(key) {
    // Primero localStorage (síncrono y fiable)
    const local = this.get(key);
    if (local) return local;
    // Fallback a DB
    try { return await DB.getProfile(key); } catch { return null; }
  },
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
    setProgress(15, 'Inicializando base de datos…');
    try { await DB.init(); } catch(e) { Logger.warn('DB error (continuando):', e); }

    setProgress(30, 'Cargando perfil…');
    await _loadUserProfile();

    setProgress(45, 'Sistema de aprendizaje…');
    try { await Learning.load(); } catch(e) { Logger.warn('Learning error:', e); }

    setProgress(60, 'Iniciando GPS…');
    Geo.start().catch(()=>{});

    // FIX #2: Cargar IA en background sin bloquear el boot
    setProgress(80, 'Preparando modelos IA…');
    _loadAIInBackground();

    setProgress(100, '¡Listo!');
    AppState.initialized = true;

    await new Promise(r => setTimeout(r, 500));

    const onboarded = Profile.get('onboarded');
    if (!onboarded) {
      Screens.show('onboarding', false);
    } else {
      Screens.show('home', false);
      _refreshHome();
    }

  } catch(err) {
    Logger.error('Boot error:', err);
    await new Promise(r => setTimeout(r, 800));
    Screens.show('home', false);
    _refreshHome();
  }

  _bindAllEvents();
}

// FIX #2: IA se carga en background, no bloquea la UI
async function _loadAIInBackground() {
  if (AppState.aiLoading || AppState.aiReady) return;
  AppState.aiLoading = true;
  _updateAIStatus('loading', 'Cargando IA (puede tardar en móvil)…');

  // Timeout de 2 minutos
  const timeoutId = setTimeout(() => {
    if (!AppState.aiReady) {
      AppState.aiLoading = false;
      _updateAIStatus('error', 'IA no disponible — modo manual activo');
      Toast.show('IA no cargó. Puedes evaluar manualmente.', 'warning');
    }
  }, 120000);

  try {
    await Detector.init((msg, pct) => {
      _updateAIStatus('loading', msg);
    });
    clearTimeout(timeoutId);
    AppState.aiReady = true;
    AppState.aiLoading = false;
    _updateAIStatus('ready', 'IA lista — detección activa');
    Toast.show('¡Modelos IA cargados!', 'success');
    // Actualizar botón de vídeo si estamos en home
    const evalBtn = document.getElementById('btn-video-evaluate');
    if (evalBtn) evalBtn.disabled = false;
  } catch(e) {
    clearTimeout(timeoutId);
    AppState.aiLoading = false;
    _updateAIStatus('error', 'IA no disponible — solo modo manual');
    Logger.error('AI load error:', e);
  }
}

/* ════════════════════════════════════════
   PERFIL / HOME
   ════════════════════════════════════════ */
async function _loadUserProfile() {
  const name  = Profile.get('userName') || 'Inspector';
  const email = Profile.get('userEmail') || '';
  document.getElementById('home-username').textContent = name;
  const sName = document.getElementById('settings-name');
  const sEmail = document.getElementById('settings-email');
  if (sName)  sName.value  = name;
  if (sEmail) sEmail.value = email;
}

async function _refreshHome() {
  const name = Profile.get('userName') || 'Inspector';
  document.getElementById('home-username').textContent = name;

  let total = 0, todayCount = 0;
  try {
    total = await DB.countEvaluations();
    todayCount = (await DB.getTodayEvaluations()).length;
  } catch {}

  const acc = null;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-today').textContent    = todayCount;
  document.getElementById('stat-accuracy').textContent = acc !== null ? `${acc}%` : '—';

  _renderRecentList();
  _updateStorageInfo();
}

async function _renderRecentList() {
  const list = document.getElementById('recent-list');
  try {
    const all    = await DB.getAllEvaluations();
    const recent = all.sort((a,b)=>b.ts-a.ts).slice(0,6);
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
          <div class="eval-card-title">${info.label||r.signType}</div>
          <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} · ${r.status}</div>
        </div>
        <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<p class="empty-state">No hay evaluaciones todavía.</p>';
  }
}

function _updateAIStatus(state, msg) {
  const dot  = document.getElementById('ai-dot');
  const text = document.getElementById('ai-status-text');
  if (!dot || !text) return;
  dot.className = `ai-dot ${state === 'ready' ? 'ready' : state === 'error' ? 'error' : 'loading'}`;
  text.textContent = msg;
}

/* ════════════════════════════════════════
   MODO VÍDEO — FIX #2: permite entrar aunque IA no esté lista
   ════════════════════════════════════════ */
async function _startVideoMode() {
  // FIX: ya no bloqueamos si IA no está lista — avisamos pero dejamos entrar
  if (!AppState.aiReady && !AppState.aiLoading) {
    _loadAIInBackground();
  }

  Screens.show('video');
  DetectionUI.clearAccumulated();

  const videoEl    = document.getElementById('video-feed');
  const canvasEl   = document.getElementById('detection-canvas');
  const countEl    = document.getElementById('video-detection-count');
  const evalBtn    = document.getElementById('btn-video-evaluate');
  const countBadge = document.getElementById('evaluate-count-badge');
  const fpsEl      = document.getElementById('fps-counter');

  try {
    await Camera.start(videoEl);
  } catch(e) {
    Toast.show(e.message, 'error');
    Screens.back();
    return;
  }

  AppState.videoSessionActive = true;

  Geo.onUpdate(pos => {
    const el = document.getElementById('gps-text');
    if (el) el.textContent = Geo.formatCoords(pos);
  });

  if (!AppState.aiReady) {
    // Modo sin IA: mostrar vídeo pero informar al usuario
    countEl.textContent = '—';
    fpsEl.textContent   = 'IA cargando…';
    evalBtn.disabled    = true;

    // Esperar a que la IA esté lista (polling cada 2s)
    const waitForAI = setInterval(() => {
      if (AppState.aiReady) {
        clearInterval(waitForAI);
        fpsEl.textContent = '— fps';
        _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl);
        Toast.show('IA lista — detección activa', 'success');
      }
      if (!AppState.aiLoading && !AppState.aiReady) {
        clearInterval(waitForAI);
        evalBtn.disabled = false; // Permitir evaluación manual
        fpsEl.textContent = 'Sin IA';
        countEl.textContent = '0';
      }
    }, 2000);
    return;
  }

  _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl);
}

function _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl) {
  let paused = false;

  Detector.startLoop(videoEl, canvasEl, detections => {
    const all = DetectionUI.accumulate(detections);
    const scaleX = canvasEl.width  / (videoEl.videoWidth  || 1);
    const scaleY = canvasEl.height / (videoEl.videoHeight || 1);
    const scaled = all.map(d=>({...d, bbox:[d.bbox[0]*scaleX,d.bbox[1]*scaleY,d.bbox[2]*scaleX,d.bbox[3]*scaleY]}));
    DetectionUI.drawDetections(canvasEl, scaled);
    countEl.textContent      = all.length;
    countBadge.textContent   = all.length;
    evalBtn.disabled         = all.length === 0;
    fpsEl.textContent        = `${Detector.getFPS()} fps`;
  });

  document.getElementById('btn-video-pause').onclick = () => {
    paused = !paused;
    document.getElementById('icon-pause').style.display = paused ? 'none' : 'block';
    document.getElementById('icon-play').style.display  = paused ? 'block' : 'none';
    if (paused) Detector.stopLoop();
    else _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl);
  };
}

function _stopVideoMode() {
  Detector.stopLoop();
  Camera.stop();
  AppState.videoSessionActive = false;
}

function _startEvaluationFromVideo() {
  const dets = DetectionUI.getAccumulated();
  if (dets.length === 0) {
    // FIX: Si no hay detecciones automáticas, crear una detección manual
    Toast.show('No se detectaron señales. Evalúa manualmente.', 'warning');
    _createManualEvaluation();
    return;
  }
  Detector.stopLoop();
  const v = document.getElementById('video-feed');
  const snap = document.createElement('canvas');
  snap.width = v.videoWidth || 640; snap.height = v.videoHeight || 480;
  snap.getContext('2d').drawImage(v, 0, 0);
  EvaluationUI.startSession(dets, snap, 'video');
}

// Evaluación manual cuando la IA no detecta nada
function _createManualEvaluation() {
  const v = document.getElementById('video-feed');
  const snap = document.createElement('canvas');
  snap.width = v.videoWidth || 640; snap.height = v.videoHeight || 480;
  snap.getContext('2d').drawImage(v, 0, 0);
  const manualDet = {
    id: `manual_${Date.now()}`,
    signType: 'UNKNOWN',
    category: 'desconocido',
    bbox: [snap.width*0.25, snap.height*0.1, snap.width*0.5, snap.height*0.5],
    confidence: 0.5,
    dominantColor: 'unknown',
    isHorizontal: false,
    crop: ImageUtils.cropToCanvas(snap, [snap.width*0.25,snap.height*0.1,snap.width*0.5,snap.height*0.5], 96),
    ts: Date.now(),
    gps: Geo.getPos(),
  };
  Detector.stopLoop();
  EvaluationUI.startSession([manualDet], snap, 'video');
}

/* ════════════════════════════════════════
   MODO FOTO — FIX #3: galería vs cámara separados
   ════════════════════════════════════════ */
function _resetPhotoScreen() {
  AppState.currentPhotoCanvas = null;
  AppState.currentPhotoDetections = [];
  document.getElementById('photo-placeholder').style.display = 'flex';
  document.getElementById('photo-canvas').style.display = 'none';
  document.getElementById('photo-detection-info').style.display = 'none';
  document.getElementById('btn-photo-evaluate').disabled = true;
}

async function _handlePhotoFile(file) {
  if (!file) return;
  const placeholder    = document.getElementById('photo-placeholder');
  const photoCanvas    = document.getElementById('photo-canvas');
  const infoEl         = document.getElementById('photo-detection-info');
  const countEl        = document.getElementById('photo-detection-count');
  const evalBtn        = document.getElementById('btn-photo-evaluate');

  placeholder.style.display = 'none';
  photoCanvas.style.display = 'block';
  infoEl.style.display      = 'block';
  countEl.textContent       = 'Analizando…';

  try {
    const bmp   = await ImageUtils.fileToImageBitmap(file);
    const canvas = ImageUtils.imageBitmapToCanvas(bmp);
    const sized  = ImageUtils.resizeCanvas(canvas, 1280, 960);

    photoCanvas.width  = sized.width;
    photoCanvas.height = sized.height;
    photoCanvas.getContext('2d').drawImage(sized, 0, 0);

    AppState.currentPhotoCanvas = sized;

    if (!AppState.aiReady) {
      // Sin IA: mostrar imagen y permitir evaluación manual
      countEl.textContent = 'IA no disponible — evaluación manual';
      const manualDet = {
        id: `manual_${Date.now()}`,
        signType: 'UNKNOWN', category: 'desconocido',
        bbox: [sized.width*0.2, sized.height*0.1, sized.width*0.6, sized.height*0.7],
        confidence: 0.5, isHorizontal: false,
        crop: ImageUtils.cropToCanvas(sized,[sized.width*0.2,sized.height*0.1,sized.width*0.6,sized.height*0.7],96),
        ts: Date.now(), gps: Geo.getPos(),
      };
      AppState.currentPhotoDetections = [manualDet];
      evalBtn.disabled = false;
      Toast.show('Evaluación manual disponible', 'warning');
      return;
    }

    const detections = await Detector.detectFrame(sized, sized);
    DetectionUI.drawOnPhoto(photoCanvas, detections);
    AppState.currentPhotoDetections = detections;
    countEl.textContent = `${detections.length} señal${detections.length!==1?'es':''} detectada${detections.length!==1?'s':''}`;
    evalBtn.disabled = detections.length === 0;

    if (detections.length === 0) {
      // Permitir evaluación manual si no detecta
      AppState.currentPhotoDetections = [{
        id:`manual_${Date.now()}`,signType:'UNKNOWN',category:'desconocido',
        bbox:[sized.width*0.2,sized.height*0.1,sized.width*0.6,sized.height*0.7],
        confidence:0.5,isHorizontal:false,
        crop:ImageUtils.cropToCanvas(sized,[sized.width*0.2,sized.height*0.1,sized.width*0.6,sized.height*0.7],96),
        ts:Date.now(),gps:Geo.getPos(),
      }];
      evalBtn.disabled = false;
      countEl.textContent = 'Sin detección — evaluación manual';
      Toast.show('No se detectaron señales. Puedes evaluar manualmente.', 'warning');
    } else {
      Toast.show(`${detections.length} señal${detections.length!==1?'es':''} detectada${detections.length!==1?'s':''}`, 'success');
    }
  } catch(e) {
    Logger.error('Photo error:', e);
    Toast.show('Error al procesar imagen', 'error');
    countEl.textContent = 'Error al analizar';
  }
}

function _startEvaluationFromPhoto() {
  if (AppState.currentPhotoDetections.length === 0) return;
  EvaluationUI.startSession(AppState.currentPhotoDetections, AppState.currentPhotoCanvas, 'photo');
}

/* ════════════════════════════════════════
   HISTORIAL
   ════════════════════════════════════════ */
async function _renderHistory(filter='all') {
  const list = document.getElementById('history-list');
  try {
    const all      = (await DB.getAllEvaluations()).sort((a,b)=>b.ts-a.ts);
    const filtered = filter==='all' ? all : filter==='vertical' ? all.filter(r=>!r.isHorizontal) : all.filter(r=>r.isHorizontal);
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">No hay evaluaciones en esta categoría.</p>';
      return;
    }
    list.innerHTML = filtered.map(r => {
      const info=SIGN_CATALOG[r.signType]||SIGN_CATALOG['UNKNOWN'];
      const rating=r.finalRating??r.aiRating??0;
      const d=new Date(r.ts);
      return `<div class="eval-card">
        <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
        <div class="eval-card-body">
          <div class="eval-card-title">${info.label||r.signType}</div>
          <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES',{timeStyle:'short'})} · ${r.status}</div>
        </div>
        <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<p class="empty-state">Error cargando historial.</p>';
  }
}

/* ════════════════════════════════════════
   SETTINGS
   ════════════════════════════════════════ */
async function _updateStorageInfo() {
  try {
    const {used,quota} = await DB.estimateSize();
    const pct   = quota>0?Math.round((used/quota)*100):0;
    const usedMB = (used/1024/1024).toFixed(1);
    const fillEl = document.getElementById('storage-fill');
    const labelEl = document.getElementById('storage-label');
    if (fillEl)  fillEl.style.width  = pct+'%';
    if (labelEl) labelEl.textContent = `${usedMB} MB (${pct}%)`;
    const count = await DB.countEvaluations();
    const countEl = document.getElementById('settings-eval-count');
    if (countEl) countEl.textContent = count;
  } catch {}
  try {
    const evCount = await DB.countEvents();
    const evEl = document.getElementById('learning-events-count');
    if (evEl) evEl.textContent = evCount;
  } catch {}
}

/* ════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════ */
function _bindAllEvents() {

  // ── ONBOARDING ──
  let slide = 0;
  const slides = document.querySelectorAll('.onboard-slide');
  const dots   = document.querySelectorAll('.dot');
  const btnNext = document.getElementById('btn-onboard-next');
  if (btnNext) {
    btnNext.onclick = () => {
      slides[slide].classList.remove('active');
      dots[slide].classList.remove('active');
      slide = Math.min(slide+1, slides.length-1);
      slides[slide].classList.add('active');
      dots[slide].classList.add('active');
      btnNext.textContent = slide===slides.length-1?'':' Siguiente';
    };
  }
  const btnFinish = document.getElementById('btn-onboard-finish');
  if (btnFinish) {
    btnFinish.onclick = () => {
      const name = (document.getElementById('onboard-name').value.trim()) || 'Inspector';
      // FIX #1: guardar en localStorage primero (síncrono y fiable)
      Profile.set('userName', name);
      Profile.set('onboarded', 'true');
      Profile.syncToDB('userName', name);
      Profile.syncToDB('onboarded', 'true');
      document.getElementById('home-username').textContent = name;
      Screens.show('home', false);
      _refreshHome();
    };
  }

  // ── HOME ──
  const q = id => document.getElementById(id);
  q('btn-mode-video').onclick = _startVideoMode;
  q('btn-mode-photo').onclick = () => { _resetPhotoScreen(); Screens.show('photo'); };
  q('btn-home-history').onclick  = () => { _renderHistory(); Screens.show('history'); };
  q('btn-home-settings').onclick = () => { _loadUserProfile(); _updateStorageInfo(); Screens.show('settings'); };

  // ── VÍDEO ──
  q('btn-video-back').onclick     = () => { _stopVideoMode(); Screens.show('home',false); _refreshHome(); };
  q('btn-video-flip').onclick     = () => Camera.flip().catch(e=>Toast.show(e.message,'error'));
  q('btn-video-evaluate').onclick = _startEvaluationFromVideo;

  // ── FOTO — FIX #3: separar galería de cámara ──
  q('btn-photo-back').onclick = () => Screens.show('home', false);

  // Galería: sin capture attribute
  q('btn-photo-gallery').onclick = () => {
    const inp = document.getElementById('file-input-gallery');
    inp.removeAttribute('capture');
    inp.click();
  };
  // Cámara: con capture attribute
  q('btn-photo-camera').onclick = () => {
    const inp = document.getElementById('file-input-camera');
    inp.setAttribute('capture', 'environment');
    inp.click();
  };

  q('file-input-gallery').onchange = e => { if(e.target.files[0]) _handlePhotoFile(e.target.files[0]); e.target.value=''; };
  q('file-input-camera').onchange  = e => { if(e.target.files[0]) _handlePhotoFile(e.target.files[0]); e.target.value=''; };
  q('btn-photo-evaluate').onclick  = _startEvaluationFromPhoto;

  // ── EVALUACIÓN ──
  q('btn-eval-back').onclick     = () => { Screens.show('home',false); _refreshHome(); };
  q('btn-eval-prev').onclick     = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex()-1);
  q('btn-eval-next').onclick     = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex()+1);
  q('btn-eval-validate').onclick = () => EvaluationUI.validate();
  q('btn-eval-reject').onclick   = () => EvaluationUI.reject();
  q('btn-eval-edit').onclick     = () => EvaluationUI.openEditor();

  // ── EDITOR ──
  q('btn-editor-cancel').onclick = () => Screens.back();
  q('btn-editor-save').onclick   = () => EvaluationUI.saveEditor();

  // ── RESUMEN ──
  q('btn-summary-export').onclick = () => ExportUI.show();
  q('btn-summary-home').onclick   = () => { Screens.show('home',false); _refreshHome(); };

  // ── HISTORIAL ──
  q('btn-history-back').onclick   = () => Screens.show('home',false);
  q('btn-history-export').onclick = () => ExportUI.show();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _renderHistory(btn.dataset.filter);
    };
  });

  // ── SETTINGS — FIX #1: guardar perfil con localStorage ──
  q('btn-settings-back').onclick = () => Screens.show('home',false);
  q('btn-settings-save-profile').onclick = () => {
    const name  = (q('settings-name').value.trim())  || 'Inspector';
    const email = (q('settings-email').value.trim()) || '';
    // Guardar en localStorage (fiable en móvil)
    Profile.set('userName', name);
    Profile.set('userEmail', email);
    // También en IndexedDB asíncrono
    Profile.syncToDB('userName', name);
    Profile.syncToDB('userEmail', email);
    document.getElementById('home-username').textContent = name;
    Toast.show('Perfil guardado ✓', 'success');
  };
  q('btn-settings-export').onclick = async () => {
    const format = q('export-format').value;
    const range  = q('export-range').value;
    await Exporter.exportData(format, range);
  };
  q('btn-clear-data').onclick = async () => {
    try {
      const n = await DB.deleteOlderThan(90);
      Toast.show(`${n} evaluaciones eliminadas`, 'success');
      _updateStorageInfo();
    } catch { Toast.show('Error al limpiar datos','error'); }
  };
  q('btn-reset-learning').onclick = async () => {
    try { await Learning.reset(); Toast.show('Aprendizaje reiniciado','warning'); } catch {}
    _updateStorageInfo();
  };

  // ── MODAL EXPORT ──
  q('btn-modal-cancel').onclick   = () => ExportUI.hide();
  q('btn-modal-download').onclick = () => ExportUI.doExport();
  q('modal-export').onclick = e => { if(e.target===e.currentTarget) ExportUI.hide(); };
}

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/GESTOR-SE-ALES/sw.js')
      .then(r => Logger.info('SW:', r.scope))
      .catch(e => Logger.warn('SW error:', e));
  });
}

document.addEventListener('DOMContentLoaded', boot);
