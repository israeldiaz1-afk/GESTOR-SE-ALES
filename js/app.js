'use strict';
/* ══════════════════════════════════════════════════════
   APP.JS v1.1 — RoadSign Evaluator
   - IA local instantánea (sin TF.js)
   - Perfiles múltiples con localStorage
   - Camera fix
   - Foto fix
   ══════════════════════════════════════════════════════ */

const Toast = {
  show(msg, type='info', duration=2800) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), duration + 300);
  },
};

/* ══════════════════════════════════════════════════════
   PERFIL — localStorage como almacén principal
   ══════════════════════════════════════════════════════ */
const Profile = {
  _key: 'rs_activeProfile',
  _allKey: 'rs_profiles',

  getAll() {
    try { return JSON.parse(localStorage.getItem(this._allKey) || '[]'); } catch { return []; }
  },

  saveAll(profiles) {
    try { localStorage.setItem(this._allKey, JSON.stringify(profiles)); return true; } catch { return false; }
  },

  getActive() {
    try {
      const id = localStorage.getItem(this._key);
      const all = this.getAll();
      return all.find(p => p.id === id) || all[0] || null;
    } catch { return null; }
  },

  setActive(id) {
    try { localStorage.setItem(this._key, id); } catch {}
  },

  create(name, email = '', org = '') {
    const profiles = this.getAll();
    const profile = { id: `p_${Date.now()}`, name: name || 'Inspector', email, org, createdAt: Date.now() };
    profiles.push(profile);
    this.saveAll(profiles);
    this.setActive(profile.id);
    return profile;
  },

  update(id, data) {
    const profiles = this.getAll();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) { profiles[idx] = { ...profiles[idx], ...data }; this.saveAll(profiles); }
  },

  delete(id) {
    const profiles = this.getAll().filter(p => p.id !== id);
    this.saveAll(profiles);
    if (this.getActive()?.id === id) {
      if (profiles.length > 0) this.setActive(profiles[0].id);
      else localStorage.removeItem(this._key);
    }
  },

  get(key) { try { return localStorage.getItem(`rs_${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`rs_${key}`, String(value)); } catch {} },
};

const AppState = {
  initialized: false,
  aiReady: false,
  videoActive: false,
  photoCanvas: null,
  photoDetections: [],
};

/* ══════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════ */
async function boot() {
  Screens.init();
  const prog   = el => document.getElementById('splash-progress').style.width = el + '%';
  const status = msg => document.getElementById('splash-status').textContent = msg;

  prog(10); status('Iniciando base de datos…');
  try { await DB.init(); } catch(e) { Logger.warn('DB:', e); }

  prog(30); status('Cargando perfil…');
  _applyActiveProfile();

  prog(50); status('Sistema de aprendizaje…');
  try { await Learning.load(); } catch(e) { Logger.warn('Learning:', e); }

  prog(70); status('GPS…');
  Geo.start().catch(() => {});

  prog(85); status('Iniciando detector…');
  try {
    await Detector.init((msg, pct) => { prog(85 + pct * 0.14); status(msg); });
    AppState.aiReady = true;
    _updateAIStatus('ready', 'Detector listo ✓');
  } catch(e) {
    Logger.error('Detector:', e);
    _updateAIStatus('error', 'Detector no disponible');
  }

  prog(100); status('¡Listo!');
  AppState.initialized = true;
  await new Promise(r => setTimeout(r, 400));

  const profiles = Profile.getAll();
  if (profiles.length === 0) {
    Screens.show('onboarding', false);
  } else {
    Screens.show('home', false);
    _refreshHome();
  }

  _bindAllEvents();
}

function _applyActiveProfile() {
  const p = Profile.getActive();
  const name = p?.name || 'Inspector';
  const el = document.getElementById('home-username');
  if (el) el.textContent = name;
  const sn = document.getElementById('settings-name');
  const se = document.getElementById('settings-email');
  const so = document.getElementById('settings-org');
  if (sn) sn.value = p?.name  || '';
  if (se) se.value = p?.email || '';
  if (so) so.value = p?.org   || '';
}

function _updateAIStatus(state, msg) {
  const dot  = document.getElementById('ai-dot');
  const text = document.getElementById('ai-status-text');
  if (!dot || !text) return;
  dot.className = `ai-dot ${state}`;
  text.textContent = msg;
}

async function _refreshHome() {
  _applyActiveProfile();
  let total = 0, todayCount = 0;
  try { total = await DB.countEvaluations(); } catch {}
  try { todayCount = (await DB.getTodayEvaluations()).length; } catch {}
  const sTotal = document.getElementById('stat-total');
  const sToday = document.getElementById('stat-today');
  const sAcc   = document.getElementById('stat-accuracy');
  if (sTotal) sTotal.textContent = total;
  if (sToday) sToday.textContent = todayCount;
  if (sAcc)   sAcc.textContent   = '—';
  _renderRecentList();
  _updateStorageInfo();
}

async function _renderRecentList() {
  const list = document.getElementById('recent-list');
  if (!list) return;
  try {
    const all    = (await DB.getAllEvaluations()).sort((a,b) => b.ts - a.ts).slice(0, 6);
    if (!all.length) { list.innerHTML = '<p class="empty-state">No hay evaluaciones todavía.</p>'; return; }
    list.innerHTML = all.map(r => {
      const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG['UNKNOWN'];
      const rating = r.finalRating ?? r.aiRating ?? 0;
      const d      = new Date(r.ts);
      return `<div class="eval-card">
        <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
        <div class="eval-card-body">
          <div class="eval-card-title">${info.label || r.signType}</div>
          <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} · ${r.status}</div>
        </div>
        <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
      </div>`;
    }).join('');
  } catch { list.innerHTML = '<p class="empty-state">No hay evaluaciones todavía.</p>'; }
}

/* ══════════════════════════════════════════════════════
   PERFILES — pantalla completa
   ══════════════════════════════════════════════════════ */
function _renderProfilesScreen() {
  const body    = document.getElementById('profiles-body');
  const profiles = Profile.getAll();
  const active  = Profile.getActive();

  if (!profiles.length) {
    body.innerHTML = '<p class="empty-state">No hay perfiles. Crea uno con + Nuevo.</p>';
    return;
  }

  body.innerHTML = profiles.map(p => `
    <div class="eval-card profile-card ${p.id === active?.id ? 'profile-active' : ''}" data-id="${p.id}">
      <div class="eval-card-icon" style="background:rgba(245,197,24,0.15)">👤</div>
      <div class="eval-card-body">
        <div class="eval-card-title">${p.name}${p.id === active?.id ? ' <span class="profile-badge">ACTIVO</span>' : ''}</div>
        <div class="eval-card-meta">${p.org || ''}${p.org && p.email ? ' · ' : ''}${p.email || ''}</div>
        <div class="eval-card-meta" style="margin-top:2px">Creado ${new Date(p.createdAt).toLocaleDateString('es-ES')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn-text-accent profile-activate" data-id="${p.id}" style="font-size:12px">Activar</button>
        <button class="btn-danger-outline profile-delete" data-id="${p.id}" style="font-size:11px;padding:4px 8px">Borrar</button>
      </div>
    </div>
  `).join('');

  // Delegación de eventos
  body.onclick = e => {
    const activateBtn = e.target.closest('.profile-activate');
    const deleteBtn   = e.target.closest('.profile-delete');
    if (activateBtn) {
      Profile.setActive(activateBtn.dataset.id);
      _renderProfilesScreen();
      _applyActiveProfile();
      Toast.show('Perfil activado ✓', 'success');
    }
    if (deleteBtn) {
      if (confirm('¿Borrar este perfil?')) {
        Profile.delete(deleteBtn.dataset.id);
        _renderProfilesScreen();
        _applyActiveProfile();
        Toast.show('Perfil eliminado', 'warning');
      }
    }
  };
}

/* ══════════════════════════════════════════════════════
   MODO VÍDEO
   ══════════════════════════════════════════════════════ */
async function _startVideoMode() {
  Screens.show('video');
  DetectionUI.clearAccumulated();

  const videoEl    = document.getElementById('video-feed');
  const canvasEl   = document.getElementById('detection-canvas');
  const countEl    = document.getElementById('video-detection-count');
  const evalBtn    = document.getElementById('btn-video-evaluate');
  const countBadge = document.getElementById('evaluate-count-badge');
  const fpsEl      = document.getElementById('fps-counter');

  evalBtn.onclick = _startEvaluationFromVideo;

  try {
    await Camera.start(videoEl);
  } catch(e) {
    Toast.show(e.message || 'Error de cámara', 'error');
    Screens.back();
    return;
  }

  AppState.videoActive = true;

  Geo.onUpdate(pos => {
    const el = document.getElementById('gps-text');
    if (el) el.textContent = Geo.formatCoords(pos);
  });

  let paused = false;
  document.getElementById('btn-video-pause').onclick = () => {
    paused = !paused;
    document.getElementById('icon-pause').style.display = paused ? 'none'  : 'block';
    document.getElementById('icon-play').style.display  = paused ? 'block' : 'none';
    if (paused) Detector.stopLoop();
    else _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl);
  };

  _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl);
}

function _startDetectionLoop(videoEl, canvasEl, countEl, evalBtn, countBadge, fpsEl) {
  Detector.startLoop(videoEl, canvasEl, detections => {
    const all = DetectionUI.accumulate(detections);
    DetectionUI.drawDetections(canvasEl, all);
    countEl.textContent      = all.length;
    countBadge.textContent   = all.length;
    fpsEl.textContent        = `${Detector.getFPS()} fps`;
  });
}

function _stopVideoMode() {
  Detector.stopLoop();
  Camera.stop();
  AppState.videoActive = false;
  const c = document.getElementById('detection-canvas');
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

function _startEvaluationFromVideo() {
  const dets = DetectionUI.getAccumulated();
  const v    = document.getElementById('video-feed');
  const snap = document.createElement('canvas');
  snap.width  = v.videoWidth  || 640;
  snap.height = v.videoHeight || 480;
  snap.getContext('2d').drawImage(v, 0, 0);

  const finalDets = dets.length > 0 ? dets : [_makeManualDetection(snap)];
  Detector.stopLoop();
  EvaluationUI.startSession(finalDets, snap, 'video');
}

function _makeManualDetection(canvas) {
  const W = canvas.width, H = canvas.height;
  const bbox = [W*0.25, H*0.1, W*0.5, H*0.6];
  return {
    id: `manual_${Date.now()}`,
    signType: 'UNKNOWN', category: 'desconocido',
    bbox, confidence: 0.5, isHorizontal: false,
    crop: ImageUtils.cropToCanvas(canvas, bbox, 96),
    ts: Date.now(), gps: Geo.getPos(),
  };
}

/* ══════════════════════════════════════════════════════
   MODO FOTO
   ══════════════════════════════════════════════════════ */
function _resetPhotoScreen() {
  AppState.photoCanvas     = null;
  AppState.photoDetections = [];
  const ph  = document.getElementById('photo-placeholder');
  const pc  = document.getElementById('photo-canvas');
  const inf = document.getElementById('photo-detection-info');
  const btn = document.getElementById('btn-photo-evaluate');
  if (ph)  ph.style.display  = 'flex';
  if (pc)  pc.style.display  = 'none';
  if (inf) inf.style.display = 'none';
  if (btn) btn.disabled      = true;
}

async function _handlePhotoFile(file) {
  if (!file) return;

  const ph    = document.getElementById('photo-placeholder');
  const pc    = document.getElementById('photo-canvas');
  const inf   = document.getElementById('photo-detection-info');
  const count = document.getElementById('photo-detection-count');
  const btn   = document.getElementById('btn-photo-evaluate');

  ph.style.display  = 'none';
  pc.style.display  = 'block';
  inf.style.display = 'block';
  count.textContent = 'Analizando imagen…';
  btn.disabled      = true;

  try {
    // Cargar imagen
    const img    = await ImageUtils.fileToImageBitmap(file);
    const canvas = ImageUtils.imageBitmapToCanvas(img);
    const sized  = ImageUtils.resizeCanvas(canvas, 1280, 960);

    // Renderizar en el canvas visible
    pc.width  = sized.width;
    pc.height = sized.height;
    pc.getContext('2d').drawImage(sized, 0, 0);

    AppState.photoCanvas = sized;

    // Detectar
    let detections = [];
    if (AppState.aiReady) {
      detections = Detector.detectFrame(sized);
      DetectionUI.drawOnPhoto(pc, detections);
    }

    if (detections.length === 0) {
      // Sin detección → evaluación manual
      detections = [_makeManualDetection(sized)];
      count.textContent = 'Sin detección automática — evaluación manual disponible';
      Toast.show('Usa "Evaluar" para clasificar la señal manualmente', 'warning');
    } else {
      count.textContent = `${detections.length} señal${detections.length !== 1 ? 'es' : ''} detectada${detections.length !== 1 ? 's' : ''}`;
      Toast.show(`${detections.length} señal${detections.length !== 1 ? 'es' : ''} detectada${detections.length !== 1 ? 's' : ''}`, 'success');
    }

    AppState.photoDetections = detections;
    btn.disabled = false;

  } catch(e) {
    Logger.error('Photo error:', e);
    count.textContent = 'Error al procesar la imagen';
    Toast.show('No se pudo procesar la imagen. Prueba con otra.', 'error');
    // Intentar evaluación manual de todas formas
    if (AppState.photoCanvas) {
      AppState.photoDetections = [_makeManualDetection(AppState.photoCanvas)];
      btn.disabled = false;
    }
  }
}

function _startEvaluationFromPhoto() {
  if (!AppState.photoDetections.length) return;
  EvaluationUI.startSession(AppState.photoDetections, AppState.photoCanvas, 'photo');
}

/* ══════════════════════════════════════════════════════
   HISTORIAL
   ══════════════════════════════════════════════════════ */
async function _renderHistory(filter = 'all') {
  const list = document.getElementById('history-list');
  if (!list) return;
  try {
    const all = (await DB.getAllEvaluations()).sort((a,b) => b.ts - a.ts);
    const filtered = filter === 'all' ? all
      : filter === 'vertical'   ? all.filter(r => !r.isHorizontal)
      : all.filter(r => r.isHorizontal);

    if (!filtered.length) { list.innerHTML = '<p class="empty-state">No hay evaluaciones.</p>'; return; }

    list.innerHTML = filtered.map(r => {
      const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG['UNKNOWN'];
      const rating = r.finalRating ?? r.aiRating ?? 0;
      const d      = new Date(r.ts);
      return `<div class="eval-card">
        <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
        <div class="eval-card-body">
          <div class="eval-card-title">${info.label || r.signType}</div>
          <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES',{timeStyle:'short'})} · ${r.status}</div>
        </div>
        <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
      </div>`;
    }).join('');
  } catch { list.innerHTML = '<p class="empty-state">Error cargando historial.</p>'; }
}

/* ══════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════ */
async function _updateStorageInfo() {
  try {
    const { used, quota } = await DB.estimateSize();
    const pct    = quota > 0 ? Math.round((used/quota)*100) : 0;
    const usedMB = (used/1024/1024).toFixed(1);
    const fill  = document.getElementById('storage-fill');
    const label = document.getElementById('storage-label');
    if (fill)  fill.style.width  = pct + '%';
    if (label) label.textContent = `${usedMB} MB (${pct}%)`;
    const count = document.getElementById('settings-eval-count');
    if (count) count.textContent = await DB.countEvaluations();
  } catch {}
  try {
    const el = document.getElementById('learning-events-count');
    if (el) el.textContent = await DB.countEvents();
  } catch {}
}

/* ══════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════ */
function _bindAllEvents() {
  const q = id => document.getElementById(id);

  // ── ONBOARDING ──
  let slide = 0;
  const slides  = document.querySelectorAll('.onboard-slide');
  const dots    = document.querySelectorAll('.dot');
  const btnNext = q('btn-onboard-next');
  if (btnNext) {
    btnNext.onclick = () => {
      slides[slide].classList.remove('active');
      dots[slide].classList.remove('active');
      slide = Math.min(slide + 1, slides.length - 1);
      slides[slide].classList.add('active');
      dots[slide].classList.add('active');
      btnNext.textContent = slide === slides.length - 1 ? '' : 'Siguiente';
    };
  }
  const btnFinish = q('btn-onboard-finish');
  if (btnFinish) {
    btnFinish.onclick = () => {
      const name = (q('onboard-name')?.value.trim()) || 'Inspector';
      Profile.create(name);
      q('home-username').textContent = name;
      Screens.show('home', false);
      _refreshHome();
    };
  }

  // ── HOME ──
  q('btn-mode-video').onclick    = _startVideoMode;
  q('btn-mode-photo').onclick    = () => { _resetPhotoScreen(); Screens.show('photo'); };
  q('btn-home-profiles').onclick = () => { _renderProfilesScreen(); Screens.show('profiles'); };
  q('btn-home-history').onclick  = () => { _renderHistory(); Screens.show('history'); };
  q('btn-home-settings').onclick = () => { _applyActiveProfile(); _updateStorageInfo(); Screens.show('settings'); };

  // ── PERFILES ──
  q('btn-profiles-back').onclick = () => Screens.show('home', false);
  q('btn-profiles-new').onclick  = () => { q('new-profile-name').value=''; q('new-profile-email').value=''; q('new-profile-org').value=''; q('modal-new-profile').style.display='flex'; };
  q('btn-profile-cancel').onclick = () => q('modal-new-profile').style.display='none';
  q('btn-profile-create').onclick = () => {
    const name  = q('new-profile-name').value.trim()  || 'Inspector';
    const email = q('new-profile-email').value.trim() || '';
    const org   = q('new-profile-org').value.trim()   || '';
    Profile.create(name, email, org);
    q('modal-new-profile').style.display = 'none';
    _renderProfilesScreen();
    _applyActiveProfile();
    Toast.show(`Perfil "${name}" creado ✓`, 'success');
  };

  // ── VÍDEO ──
  q('btn-video-back').onclick = () => { _stopVideoMode(); Screens.show('home', false); _refreshHome(); };
  q('btn-video-flip').onclick = () => Camera.flip().catch(e => Toast.show(e.message || 'Error cámara', 'error'));

  // ── FOTO ──
  q('btn-photo-back').onclick    = () => Screens.show('home', false);
  q('btn-photo-gallery').onclick = () => { q('file-input-gallery').value=''; q('file-input-gallery').click(); };
  q('btn-photo-camera').onclick  = () => { q('file-input-camera').value='';  q('file-input-camera').click(); };
  q('file-input-gallery').onchange = e => { if(e.target.files[0]) _handlePhotoFile(e.target.files[0]); };
  q('file-input-camera').onchange  = e => { if(e.target.files[0]) _handlePhotoFile(e.target.files[0]); };
  q('btn-photo-evaluate').onclick  = _startEvaluationFromPhoto;

  // ── EVALUACIÓN ──
  q('btn-eval-back').onclick     = () => { Screens.show('home', false); _refreshHome(); };
  q('btn-eval-prev').onclick     = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex() - 1);
  q('btn-eval-next').onclick     = () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex() + 1);
  q('btn-eval-validate').onclick = () => EvaluationUI.validate();
  q('btn-eval-reject').onclick   = () => EvaluationUI.reject();
  q('btn-eval-edit').onclick     = () => EvaluationUI.openEditor();

  // ── EDITOR ──
  q('btn-editor-cancel').onclick = () => Screens.back();
  q('btn-editor-save').onclick   = () => EvaluationUI.saveEditor();

  // ── RESUMEN ──
  q('btn-summary-export').onclick = () => ExportUI.show();
  q('btn-summary-home').onclick   = () => { Screens.show('home', false); _refreshHome(); };

  // ── HISTORIAL ──
  q('btn-history-back').onclick   = () => Screens.show('home', false);
  q('btn-history-export').onclick = () => ExportUI.show();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderHistory(btn.dataset.filter);
    };
  });

  // ── SETTINGS ──
  q('btn-settings-back').onclick = () => Screens.show('home', false);
  q('btn-settings-save-profile').onclick = () => {
    const active = Profile.getActive();
    const name  = q('settings-name').value.trim()  || 'Inspector';
    const email = q('settings-email').value.trim() || '';
    const org   = q('settings-org').value.trim()   || '';
    if (active) {
      Profile.update(active.id, { name, email, org });
    } else {
      Profile.create(name, email, org);
    }
    q('home-username').textContent = name;
    Toast.show('Perfil guardado ✓', 'success');
  };
  q('btn-settings-export').onclick = async () => {
    await Exporter.exportData(q('export-format').value, q('export-range').value);
  };
  q('btn-clear-data').onclick = async () => {
    try { const n = await DB.deleteOlderThan(90); Toast.show(`${n} evaluaciones eliminadas`, 'success'); _updateStorageInfo(); }
    catch { Toast.show('Error al limpiar', 'error'); }
  };
  q('btn-reset-learning').onclick = async () => {
    try { await Learning.reset(); Toast.show('Aprendizaje reiniciado', 'warning'); } catch {}
    _updateStorageInfo();
  };

  // ── MODAL EXPORT ──
  q('btn-modal-cancel').onclick   = () => ExportUI.hide();
  q('btn-modal-download').onclick = () => ExportUI.doExport();
  q('modal-export').onclick = e => { if(e.target === e.currentTarget) ExportUI.hide(); };
}

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(r => Logger.info('SW ok:', r.scope))
      .catch(e => Logger.warn('SW error:', e));
  });
}

document.addEventListener('DOMContentLoaded', boot);
