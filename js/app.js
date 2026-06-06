'use strict';
/* ══════════════════════════════════════════════
   APP.JS v1.3 — RoadSign Evaluator
   Bugs corregidos:
   - Navegación + botón back Android
   - Video: canvas offscreen + escalado correcto
   - Foto: visor propio en lugar de file input
   - Evaluación: try-catch en validate/reject
   - Detección: sin falsos positivos (compacidad)
   ══════════════════════════════════════════════ */

// ── Toast global ──
const Toast = {
  show(msg, type='info', duration=2600) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), duration + 300);
  },
};

// ── Perfiles ──
const Profile = {
  _KEY: 'rs_profiles',
  _ACT: 'rs_active',
  getAll()  { try { return JSON.parse(localStorage.getItem(this._KEY)||'[]'); } catch { return []; } },
  saveAll(p){ try { localStorage.setItem(this._KEY, JSON.stringify(p)); } catch {} },
  getActive(){
    const id  = localStorage.getItem(this._ACT);
    const all = this.getAll();
    return all.find(p=>p.id===id) || all[0] || null;
  },
  setActive(id){ try { localStorage.setItem(this._ACT, id); } catch {} },
  create(name, email='', org=''){
    const all = this.getAll();
    const p   = { id:`p${Date.now()}`, name:name||'Inspector', email, org, createdAt:Date.now() };
    all.push(p); this.saveAll(all); this.setActive(p.id);
    return p;
  },
  update(id, data){
    const all = this.getAll();
    const i   = all.findIndex(p=>p.id===id);
    if (i>=0) { all[i]={...all[i],...data}; this.saveAll(all); }
  },
  delete(id){
    const all = this.getAll().filter(p=>p.id!==id);
    this.saveAll(all);
    if (this.getActive()?.id===id) {
      this.setActive(all[0]?.id || '');
    }
  },
};

// ── Estado ──
const App = {
  aiReady:    false,
  videoActive:false,
  photoCanvas:null,
  photoDets:  [],
  // Canvas del cámara para modo foto
  _photoCamStream: null,
};

/* ══════════════════════════════
   BOOT
   ══════════════════════════════ */
async function boot() {
  Screens.init();
  const prog   = p  => { const el=document.getElementById('splash-progress'); if(el) el.style.width=p+'%'; };
  const status = s  => { const el=document.getElementById('splash-status');   if(el) el.textContent=s; };

  prog(10); status('Base de datos…');
  try { await DB.init(); } catch(e) { console.warn('DB init failed:', e); }

  prog(25); status('Perfil…');
  _applyProfile();

  prog(40); status('Aprendizaje…');
  try { await Learning.load(); } catch(e) {}

  prog(55); status('GPS…');
  Geo.start().catch(()=>{});

  prog(70); status('Detector…');
  try {
    await Detector.init((msg, pct) => { prog(70 + pct*0.28); status(msg); });
    App.aiReady = true;
    _setAIStatus('ready', '✓ Detector listo — análisis por color+forma');
  } catch(e) {
    console.error('Detector init failed:', e);
    _setAIStatus('error', 'Detector no disponible');
  }

  prog(100); status('¡Listo!');
  await new Promise(r=>setTimeout(r,350));

  if (Profile.getAll().length === 0) {
    Screens.show('onboarding', false);
  } else {
    Screens.show('home', false);
    _refreshHome();
  }

  _bindEvents();
}

function _applyProfile() {
  const p    = Profile.getActive();
  const name = p?.name || 'Inspector';
  _setTxt('home-username',   name);
  _setVal('settings-name',   p?.name  || '');
  _setVal('settings-email',  p?.email || '');
  _setVal('settings-org',    p?.org   || '');
}

function _setAIStatus(state, msg) {
  const dot  = document.getElementById('ai-dot');
  const text = document.getElementById('ai-status-text');
  if (dot)  dot.className   = `ai-dot ${state}`;
  if (text) text.textContent = msg;
}

async function _refreshHome() {
  _applyProfile();
  let total=0, today=0;
  try { total = await DB.countEvaluations(); } catch {}
  try { today = (await DB.getTodayEvaluations()).length; } catch {}
  _setTxt('stat-total', String(total));
  _setTxt('stat-today', String(today));
  _setTxt('stat-accuracy', '—');
  _renderRecent();
  _updateStorage();
}

async function _renderRecent() {
  const list = document.getElementById('recent-list');
  if (!list) return;
  try {
    const all = (await DB.getAllEvaluations()).sort((a,b)=>b.ts-a.ts).slice(0,6);
    if (!all.length) { list.innerHTML='<p class="empty-state">No hay evaluaciones todavía.</p>'; return; }
    list.innerHTML = all.map(r => {
      const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG.UNKNOWN;
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
  } catch { list.innerHTML='<p class="empty-state">No hay evaluaciones todavía.</p>'; }
}

/* ══════════════════════════════
   PERFILES
   ══════════════════════════════ */
function _renderProfiles() {
  const body    = document.getElementById('profiles-body');
  if (!body) return;
  const profiles = Profile.getAll();
  const active   = Profile.getActive();
  if (!profiles.length) {
    body.innerHTML = '<p class="empty-state">No hay perfiles. Crea uno con + Nuevo.</p>';
    return;
  }
  body.innerHTML = profiles.map(p => `
    <div class="eval-card">
      <div class="eval-card-icon" style="background:rgba(245,197,24,.12)">👤</div>
      <div class="eval-card-body">
        <div class="eval-card-title">${p.name}${p.id===active?.id?' <span class="profile-badge">ACTIVO</span>':''}</div>
        <div class="eval-card-meta">${[p.org,p.email].filter(Boolean).join(' · ')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <button class="btn-text-accent" onclick="Profile.setActive('${p.id}');_renderProfiles();_applyProfile();Toast.show('Perfil activado','success')">Activar</button>
        <button class="btn-danger-outline" style="font-size:11px;padding:4px 10px"
          onclick="if(confirm('¿Borrar?')){Profile.delete('${p.id}');_renderProfiles();_applyProfile();}">Borrar</button>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════
   MODO VÍDEO
   ══════════════════════════════ */
async function _startVideo() {
  Screens.show('video');
  DetectionUI.clearAccumulated();

  const videoEl  = document.getElementById('video-feed');
  const canvasEl = document.getElementById('detection-canvas');

  try {
    await Camera.start(videoEl);
  } catch(e) {
    Toast.show(e.message, 'error');
    Screens.back();
    return;
  }

  App.videoActive = true;

  // Registrar callback para parar cámara al salir
  Screens.onLeave(() => _stopVideo());

  // GPS
  Geo.onUpdate(pos => _setTxt('gps-text', Geo.formatCoords(pos)));
  const pos = Geo.getPos();
  if (pos) _setTxt('gps-text', Geo.formatCoords(pos));

  // Loop de detección
  Detector.startLoop(videoEl, dets => {
    // Escalar bboxes (ya tienen sourceW/H del offscreen)
    if (dets.length > 0) DetectionUI.accumulate(dets);
    DetectionUI.drawDetections(canvasEl, dets);

    const total = DetectionUI.getAccumulated().length;
    _setTxt('video-detection-count', String(total));
    _setTxt('evaluate-count-badge', String(total));
    const btn = document.getElementById('btn-video-evaluate');
    if (btn) btn.disabled = total === 0;
    _setTxt('fps-counter', `${Detector.getFPS()} fps`);
  });

  // Pausa
  let paused = false;
  document.getElementById('btn-video-pause').onclick = () => {
    paused = !paused;
    document.getElementById('icon-pause').style.display = paused ? 'none' : 'block';
    document.getElementById('icon-play').style.display  = paused ? 'block' : 'none';
    if (paused) Detector.stopLoop();
    else Detector.startLoop(videoEl, arguments.callee);
  };
}

function _stopVideo() {
  Detector.stopLoop();
  Camera.stop();
  App.videoActive = false;
  const c = document.getElementById('detection-canvas');
  if (c) c.getContext('2d').clearRect(0,0,c.width,c.height);
}

function _evalFromVideo() {
  const dets = DetectionUI.getAccumulated();
  const v    = document.getElementById('video-feed');
  const snap = document.createElement('canvas');
  snap.width  = v.videoWidth  || 640;
  snap.height = v.videoHeight || 480;
  snap.getContext('2d').drawImage(v,0,0);
  Detector.stopLoop();
  const finalDets = dets.length > 0 ? dets : [_manualDet(snap)];
  EvaluationUI.startSession(finalDets, snap, 'video');
}

function _manualDet(canvas) {
  const W=canvas.width, H=canvas.height;
  const bbox=[W*.2, H*.1, W*.6, H*.7];
  return {
    id:`manual${Date.now()}`, signType:'UNKNOWN', category:'desconocido',
    bbox, sourceW:W, sourceH:H, confidence:.5, isHorizontal:false,
    crop: ImageUtils.cropToCanvas(canvas,bbox,96), ts:Date.now(), gps:Geo.getPos(),
  };
}

/* ══════════════════════════════
   MODO FOTO
   ══════════════════════════════ */
function _resetPhoto() {
  App.photoCanvas = null; App.photoDets = [];
  _stopPhotoCam();
  _show('photo-placeholder', 'flex');
  _hide('photo-canvas');
  _hide('photo-detection-info');
  const btn = document.getElementById('btn-photo-evaluate');
  if (btn) btn.disabled = true;
}

async function _handlePhotoFile(file) {
  if (!file) return;
  _show('photo-canvas');
  _hide('photo-placeholder');
  _show('photo-detection-info');
  _setTxt('photo-detection-count', 'Analizando…');

  const pc  = document.getElementById('photo-canvas');
  const btn = document.getElementById('btn-photo-evaluate');
  if (btn) btn.disabled = true;

  try {
    const img    = await ImageUtils.fileToImageBitmap(file);
    const canvas = ImageUtils.imageBitmapToCanvas(img);
    const sized  = ImageUtils.resizeCanvas(canvas, 1280, 960);

    pc.width  = sized.width;
    pc.height = sized.height;
    pc.getContext('2d').drawImage(sized, 0, 0);
    App.photoCanvas = sized;

    let dets = [];
    if (App.aiReady) {
      dets = Detector.detectFrame(sized); // ya tienen sourceW/H
      if (dets.length > 0) DetectionUI.drawOnPhoto(pc, dets);
    }

    if (dets.length === 0) {
      dets = [_manualDet(sized)];
      _setTxt('photo-detection-count', 'Sin detección — evaluación manual');
      Toast.show('Evalúa manualmente con el botón Evaluar', 'warning');
    } else {
      _setTxt('photo-detection-count', `${dets.length} señal${dets.length!==1?'es':''} detectada${dets.length!==1?'s':''}`);
      Toast.show(`${dets.length} señal${dets.length!==1?'es':''} detectada${dets.length!==1?'s':''}`, 'success');
    }

    App.photoDets  = dets;
    if (btn) btn.disabled = false;
  } catch(e) {
    console.error('Photo error:', e);
    Toast.show('Error procesando imagen', 'error');
    _setTxt('photo-detection-count', 'Error');
    if (App.photoCanvas) {
      App.photoDets = [_manualDet(App.photoCanvas)];
      if (btn) btn.disabled = false;
    }
  }
}

// Botón "Cámara" en modo foto: abre minivisor con getUserMedia
async function _openPhotoCam() {
  // Si ya hay un stream abierto, cerrar primero
  _stopPhotoCam();

  const container = document.getElementById('photo-canvas-container');
  const placeholder = document.getElementById('photo-placeholder');
  const pc = document.getElementById('photo-canvas');

  // Crear elemento video temporal
  let camVideo = document.getElementById('photo-cam-video');
  if (!camVideo) {
    camVideo = document.createElement('video');
    camVideo.id = 'photo-cam-video';
    camVideo.setAttribute('autoplay', '');
    camVideo.setAttribute('muted', '');
    camVideo.setAttribute('playsinline', '');
    camVideo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:5;';
    container.appendChild(camVideo);
  }

  // Botón de captura
  let captureBtn = document.getElementById('photo-capture-btn');
  if (!captureBtn) {
    captureBtn = document.createElement('button');
    captureBtn.id = 'photo-capture-btn';
    captureBtn.textContent = '📷 Capturar';
    captureBtn.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:10;background:#f5c518;color:#000;font-weight:700;padding:12px 28px;border-radius:24px;border:none;font-size:16px;';
    container.appendChild(captureBtn);
  }
  captureBtn.style.display = 'block';
  placeholder.style.display = 'none';
  pc.style.display = 'none';

  try {
    App._photoCamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width:{ideal:1280}, height:{ideal:720} },
      audio: false,
    });
    camVideo.srcObject = App._photoCamStream;
    await camVideo.play();

    captureBtn.onclick = () => {
      // Capturar frame del vídeo
      const snap = document.createElement('canvas');
      snap.width  = camVideo.videoWidth  || 640;
      snap.height = camVideo.videoHeight || 480;
      snap.getContext('2d').drawImage(camVideo, 0, 0);

      // Detener visor
      _stopPhotoCam();
      placeholder.style.display = 'none';
      pc.style.display = 'block';
      captureBtn.style.display = 'none';
      if (camVideo) camVideo.style.display = 'none';

      // Procesar como si fuera un fichero
      snap.toBlob(blob => {
        if (blob) _handlePhotoFile(new File([blob], 'capture.jpg', {type:'image/jpeg'}));
      }, 'image/jpeg', 0.9);
    };
  } catch(e) {
    Toast.show('No se pudo acceder a la cámara: ' + e.message, 'error');
    _stopPhotoCam();
    placeholder.style.display = 'flex';
  }
}

function _stopPhotoCam() {
  if (App._photoCamStream) {
    App._photoCamStream.getTracks().forEach(t=>t.stop());
    App._photoCamStream = null;
  }
  const camVideo = document.getElementById('photo-cam-video');
  if (camVideo) { camVideo.srcObject=null; camVideo.style.display='none'; }
  const captureBtn = document.getElementById('photo-capture-btn');
  if (captureBtn) captureBtn.style.display='none';
}

function _evalFromPhoto() {
  if (!App.photoDets.length) { Toast.show('Carga una imagen primero','warning'); return; }
  EvaluationUI.startSession(App.photoDets, App.photoCanvas, 'photo');
}

/* ══════════════════════════════
   HISTORIAL
   ══════════════════════════════ */
async function _renderHistory(filter='all') {
  const list = document.getElementById('history-list');
  if (!list) return;
  try {
    const all = (await DB.getAllEvaluations()).sort((a,b)=>b.ts-a.ts);
    const rows = filter==='all' ? all : filter==='vertical' ? all.filter(r=>!r.isHorizontal) : all.filter(r=>r.isHorizontal);
    if (!rows.length) { list.innerHTML='<p class="empty-state">No hay evaluaciones.</p>'; return; }
    list.innerHTML = rows.map(r => {
      const info   = SIGN_CATALOG[r.signType] || SIGN_CATALOG.UNKNOWN;
      const rating = r.finalRating ?? r.aiRating ?? 0;
      const d      = new Date(r.ts);
      return `<div class="eval-card">
        <div class="eval-card-icon" style="background:${info.color}22">${info.icon}</div>
        <div class="eval-card-body">
          <div class="eval-card-title">${info.label||r.signType}</div>
          <div class="eval-card-meta">${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES',{timeStyle:'short'})} · ${r.status}</div>
        </div>
        <div class="eval-card-rating ${ratingClass(rating)}">${rating}</div>
      </div>`;
    }).join('');
  } catch { list.innerHTML='<p class="empty-state">Error cargando historial.</p>'; }
}

/* ══════════════════════════════
   SETTINGS
   ══════════════════════════════ */
async function _updateStorage() {
  try {
    const {used,quota} = await DB.estimateSize();
    const pct  = quota>0?Math.round(used/quota*100):0;
    const mb   = (used/1024/1024).toFixed(1);
    const fill = document.getElementById('storage-fill');
    const lbl  = document.getElementById('storage-label');
    if (fill) fill.style.width   = pct+'%';
    if (lbl)  lbl.textContent    = `${mb} MB (${pct}%)`;
    const cnt = await DB.countEvaluations();
    _setTxt('settings-eval-count', String(cnt));
  } catch {}
  try { _setTxt('learning-events-count', String(await DB.countEvents())); } catch {}
}

/* ══════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════ */
function _bindEvents() {
  const q = id => document.getElementById(id);

  // Onboarding
  let slide = 0;
  const slides = document.querySelectorAll('.onboard-slide');
  const dots   = document.querySelectorAll('.dot');
  q('btn-onboard-next')?.addEventListener('click', () => {
    slides[slide].classList.remove('active');
    dots[slide].classList.remove('active');
    slide = Math.min(slide+1, slides.length-1);
    slides[slide].classList.add('active');
    dots[slide].classList.add('active');
    q('btn-onboard-next').textContent = slide===slides.length-1 ? '' : 'Siguiente';
  });
  q('btn-onboard-finish')?.addEventListener('click', () => {
    const name = q('onboard-name')?.value.trim() || 'Inspector';
    Profile.create(name);
    _applyProfile();
    Screens.show('home', false);
    _refreshHome();
  });

  // Home
  q('btn-mode-video')?.addEventListener('click', _startVideo);
  q('btn-mode-photo')?.addEventListener('click', () => { _resetPhoto(); Screens.show('photo'); });
  q('btn-home-profiles')?.addEventListener('click', () => { _renderProfiles(); Screens.show('profiles'); });
  q('btn-home-history')?.addEventListener('click',  () => { _renderHistory();  Screens.show('history'); });
  q('btn-home-settings')?.addEventListener('click', () => { _applyProfile();   _updateStorage(); Screens.show('settings'); });

  // Perfiles
  q('btn-profiles-back')?.addEventListener('click', () => Screens.back());
  q('btn-profiles-new')?.addEventListener('click', () => {
    _setVal('new-profile-name',''); _setVal('new-profile-email',''); _setVal('new-profile-org','');
    _show('modal-new-profile');
  });
  q('btn-profile-cancel')?.addEventListener('click', () => _hide('modal-new-profile'));
  q('btn-profile-create')?.addEventListener('click', () => {
    const name  = q('new-profile-name')?.value.trim()  || 'Inspector';
    const email = q('new-profile-email')?.value.trim() || '';
    const org   = q('new-profile-org')?.value.trim()   || '';
    Profile.create(name, email, org);
    _hide('modal-new-profile');
    _renderProfiles(); _applyProfile();
    Toast.show(`Perfil "${name}" creado ✓`, 'success');
  });

  // Vídeo
  q('btn-video-back')?.addEventListener('click', () => { _stopVideo(); Screens.show('home',false); _refreshHome(); });
  q('btn-video-flip')?.addEventListener('click', () => Camera.flip().catch(e=>Toast.show(e.message,'error')));
  q('btn-video-evaluate')?.addEventListener('click', _evalFromVideo);

  // Foto
  q('btn-photo-back')?.addEventListener('click', () => { _stopPhotoCam(); Screens.back(); });
  q('btn-photo-gallery')?.addEventListener('click', () => {
    _stopPhotoCam();
    q('file-input-gallery').value = '';
    q('file-input-gallery').click();
  });
  q('btn-photo-camera')?.addEventListener('click', _openPhotoCam);
  q('file-input-gallery')?.addEventListener('change', e => { if(e.target.files[0]) _handlePhotoFile(e.target.files[0]); });
  q('btn-photo-evaluate')?.addEventListener('click', _evalFromPhoto);

  // Evaluación
  q('btn-eval-back')?.addEventListener('click', () => { Screens.show('home',false); _refreshHome(); });
  q('btn-eval-prev')?.addEventListener('click', () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex()-1));
  q('btn-eval-next')?.addEventListener('click', () => EvaluationUI.navigateTo(EvaluationUI.getCurrentIndex()+1));
  q('btn-eval-validate')?.addEventListener('click', () => EvaluationUI.validate());
  q('btn-eval-reject')?.addEventListener('click',   () => EvaluationUI.reject());
  q('btn-eval-edit')?.addEventListener('click',     () => EvaluationUI.openEditor());

  // Editor
  q('btn-editor-cancel')?.addEventListener('click', () => Screens.back());
  q('btn-editor-save')?.addEventListener('click',   () => EvaluationUI.saveEditor());

  // Resumen
  q('btn-summary-export')?.addEventListener('click', () => ExportUI.show());
  q('btn-summary-home')?.addEventListener('click',   () => { Screens.show('home',false); _refreshHome(); });

  // Historial
  q('btn-history-back')?.addEventListener('click',   () => Screens.back());
  q('btn-history-export')?.addEventListener('click', () => ExportUI.show());
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _renderHistory(btn.dataset.filter);
    });
  });

  // Settings
  q('btn-settings-back')?.addEventListener('click', () => Screens.back());
  q('btn-settings-save-profile')?.addEventListener('click', () => {
    const p    = Profile.getActive();
    const name  = q('settings-name')?.value.trim()  || 'Inspector';
    const email = q('settings-email')?.value.trim() || '';
    const org   = q('settings-org')?.value.trim()   || '';
    if (p) Profile.update(p.id, {name,email,org});
    else   Profile.create(name, email, org);
    _applyProfile();
    Toast.show('Perfil guardado ✓', 'success');
  });
  q('btn-settings-export')?.addEventListener('click', async () => {
    await Exporter.exportData(q('export-format')?.value||'csv', q('export-range')?.value||'all');
  });
  q('btn-clear-data')?.addEventListener('click', async () => {
    try { const n=await DB.deleteOlderThan(90); Toast.show(`${n} eliminadas`,'success'); _updateStorage(); }
    catch { Toast.show('Error','error'); }
  });
  q('btn-reset-learning')?.addEventListener('click', async () => {
    try { await Learning.reset(); Toast.show('Aprendizaje reiniciado','warning'); } catch {}
    _updateStorage();
  });

  // Modal export
  q('btn-modal-cancel')?.addEventListener('click', () => ExportUI.hide());
  q('btn-modal-download')?.addEventListener('click', () => ExportUI.doExport());
  q('modal-export')?.addEventListener('click', e => { if(e.target===e.currentTarget) ExportUI.hide(); });
}

// ── Helpers DOM ──
function _setTxt(id, t)   { const el=document.getElementById(id); if(el) el.textContent=t; }
function _setVal(id, v)   { const el=document.getElementById(id); if(el) el.value=v; }
function _show(id, d='flex') { const el=typeof id==='string'?document.getElementById(id):id; if(el) el.style.display=d; }
function _hide(id)        { const el=typeof id==='string'?document.getElementById(id):id; if(el) el.style.display='none'; }

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('[SW] registered:', r.scope))
      .catch(e => console.warn('[SW] error:', e));
  });
}

document.addEventListener('DOMContentLoaded', boot);
