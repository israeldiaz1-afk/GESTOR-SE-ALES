'use strict';
const EvaluationUI = (() => {
  let _dets=[], _proposals=[], _vals=[], _idx=0;
  let _srcCanvas=null, _mode='video', _t0=0, _ok=0, _ko=0;

  function startSession(detections, sourceCanvas, mode) {
    if (!detections || detections.length === 0) {
      Toast.show('No hay señales para evaluar', 'warning');
      return;
    }
    _dets   = detections;
    _srcCanvas = sourceCanvas;
    _mode   = mode || 'video';
    _t0     = Date.now();
    _ok = _ko = _idx = 0;

    _proposals = _dets.map(d => {
      try { return EvaluationEngine.propose(d, _srcCanvas); }
      catch(e) { return { values: _defaultValues(), rating: 50, confidence: 50, source:'ai' }; }
    });
    _vals = _proposals.map(p => ({ ...p.values }));

    const badge = document.getElementById('eval-mode-badge');
    if (badge) badge.textContent = _mode.toUpperCase();

    _render();
    Screens.show('evaluation');
  }

  function _defaultValues() {
    const v = {};
    for (const p of PARAMS) v[p.id] = 3;
    return v;
  }

  function _render() {
    if (_idx < 0 || _idx >= _dets.length) return;
    const det  = _dets[_idx];
    const prop = _proposals[_idx];
    const vals = _vals[_idx];

    // Navegación
    _set('eval-counter', `Señal ${_idx+1}/${_dets.length}`);
    _setDisabled('btn-eval-prev', _idx === 0);
    _setDisabled('btn-eval-next', _idx === _dets.length-1);

    // Thumbnail
    const thumb = document.getElementById('eval-thumbnail');
    if (thumb && det.crop) {
      thumb.width  = det.crop.width  || 96;
      thumb.height = det.crop.height || 96;
      try { thumb.getContext('2d').drawImage(det.crop, 0, 0); } catch(e) {}
      // Al tocar la miniatura, abrir el visor con zoom y paneo
      thumb.onclick = () => {
        const label = (SIGN_CATALOG[det.signType]?.label || det.signType || 'Señal');
        ImageViewer.open(det.crop, label);
      };
    }

    // Info
    _set('eval-signal-type', det.signType || 'UNKNOWN');
    _set('eval-confidence',  `${prop.confidence || 0}%`);
    _set('eval-type-tag',    det.isHorizontal ? 'HORIZONTAL' : 'VERTICAL');
    _set('eval-location',    Geo.formatForDisplay(det.gps));
    // Ubicación tocable: abre Google Maps en las coordenadas
    const locEl = document.getElementById('eval-location');
    if (locEl) {
      const url = Geo.mapsUrl(det.gps);
      if (url) {
        locEl.style.cursor = 'pointer';
        locEl.style.textDecoration = 'underline';
        locEl.onclick = () => window.open(url, '_blank');
      } else {
        locEl.onclick = null;
      }
    }
    // Si viene del vídeo, indicar de cuántos fotogramas se eligió la mejor imagen
    const tsBase = det.ts ? new Date(det.ts).toLocaleString('es-ES',{timeStyle:'short',dateStyle:'short'}) : '—';
    const capInfo = det.timesDetected ? `  ·  mejor de ${det.timesDetected} capturas` : '';
    _set('eval-timestamp', tsBase + capInfo);

    // Gauge
    _gauge(calcRating(vals));

    // Parámetros
    _renderParams(vals, prop.values);
  }

  function _gauge(rating) {
    const fill = document.getElementById('gauge-fill');
    const val  = document.getElementById('gauge-value');
    if (fill) {
      fill.style.strokeDashoffset = String(157 - (rating/100)*157);
      fill.style.stroke = ratingColor(rating);
    }
    if (val) {
      val.textContent = String(rating);
      val.className   = `gauge-value ${ratingClass(rating)}`;
    }
  }

  function _renderParams(vals, aiVals) {
    const c = document.getElementById('eval-params');
    if (!c) return;
    c.innerHTML = '';
    for (const p of PARAMS) {
      const v    = vals[p.id] ?? 3;
      const aiV  = aiVals[p.id] ?? 3;
      const edited = v !== aiV;
      const pct  = ((v-1)/4)*100;
      const col  = v>=5?'#22c55e':v>=4?'#84cc16':v>=3?'#f5c518':v>=2?'#f97316':'#ef4444';
      const row  = document.createElement('div');
      row.className = `param-row ${edited?'user-edited':'ai-proposed'}`;
      row.innerHTML = `
        <div class="param-icon">${p.icon}</div>
        <div class="param-body">
          <div class="param-name">${p.label}</div>
          <div class="param-value">${p.levels[v-1]?.label || v}</div>
        </div>
        <div class="param-bar-wrap">
          <div class="param-bar"><div class="param-bar-fill" style="width:${pct}%;background:${col}"></div></div>
        </div>
        <div class="param-source-badge ${edited?'badge-user':'badge-ai'}">${edited?'TÚ':'IA'}</div>`;
      c.appendChild(row);
    }
  }

  // ── ACCIONES ──

  async function validate() {
    try {
      const det  = _dets[_idx];
      const prop = _proposals[_idx];
      const uv   = _vals[_idx];
      const changed = Object.keys(uv).some(k => uv[k] !== prop.values[k]);
      const record  = _buildRecord(det, prop, uv, changed ? 'edited' : 'accepted');
      try {
        const id = await DB.saveEvaluation(record);
        if (det.crop) {
          det.crop.toBlob(b => { if (b) DB.saveCropImage(id, b); }, 'image/jpeg', 0.8);
        }
        await EvaluationEngine.recordValidation(det, prop.values, uv, !changed);
      } catch(dbErr) {
        console.warn('[EvalUI] DB save failed (continuing):', dbErr);
      }
      _ok++;
      Toast.show('✓ Validada', 'success');
      _advance();
    } catch(e) {
      console.error('[EvalUI] validate error:', e);
      Toast.show('Error al validar', 'error');
    }
  }

  async function reject() {
    try {
      const det  = _dets[_idx];
      const prop = _proposals[_idx];
      const record = _buildRecord(det, prop, null, 'rejected');
      try { await DB.saveEvaluation(record); } catch(e) { console.warn('[EvalUI] DB save failed:', e); }
      _ko++;
      Toast.show('Rechazada', 'warning');
      _advance();
    } catch(e) {
      console.error('[EvalUI] reject error:', e);
      Toast.show('Error al rechazar', 'error');
    }
  }

  function _advance() {
    if (_idx < _dets.length - 1) {
      _idx++;
      _render();
    } else {
      _showSummary();
    }
  }

  function _buildRecord(det, prop, uv, status) {
    return {
      ts:           det.ts || Date.now(),
      signType:     det.signType,
      category:     det.category,
      isHorizontal: !!det.isHorizontal,
      bbox:         det.bbox,
      lat:          det.gps?.lat || null,
      lng:          det.gps?.lng || null,
      accuracy:     det.gps?.acc || null,
      aiValues:     prop.values,
      aiRating:     prop.rating,
      userValues:   uv || null,
      finalRating:  uv ? calcRating(uv) : null,
      status,
      sessionMode:  _mode,
      confidence:   prop.confidence,
    };
  }

  function navigateTo(idx) {
    if (idx >= 0 && idx < _dets.length) {
      _idx = idx;
      _render();
    }
  }

  // ── EDITOR ──

  function openEditor() {
    const vals = _vals[_idx];
    const body = document.getElementById('editor-body');
    if (!body) return;
    body.innerHTML = '';

    for (const param of PARAMS) {
      const cur = vals[param.id] ?? 3;
      const block = document.createElement('div');
      block.className = 'editor-param-block';
      block.innerHTML = `
        <div class="editor-param-header">
          <span class="editor-param-icon">${param.icon}</span>
          <span class="editor-param-label">${param.label}</span>
          <span class="editor-param-current">${param.description}</span>
        </div>
        <div class="editor-param-options" data-param="${param.id}">
          ${param.levels.map(l => `
            <button class="editor-option ${l.value===cur?'selected':''}"
                    data-value="${l.value}" data-param="${param.id}">
              <span>${l.value}</span><span>${l.label}</span>
            </button>`).join('')}
        </div>`;
      body.appendChild(block);
    }

    body.onclick = e => {
      const btn = e.target.closest('.editor-option');
      if (!btn) return;
      const param = btn.dataset.param;
      const value = parseInt(btn.dataset.value);
      btn.closest('.editor-param-options')
         .querySelectorAll('.editor-option')
         .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _vals[_idx][param] = value;
      _updateEditorRating();
    };

    _updateEditorRating();
    Screens.show('editor');
  }

  function _updateEditorRating() {
    const el = document.getElementById('editor-rating-live');
    if (!el) return;
    const r = calcRating(_vals[_idx]);
    el.textContent = String(r);
    el.className   = `editor-rating-value ${ratingClass(r)}`;
  }

  function saveEditor() {
    _render();
    Screens.back();
    Toast.show('Guardado ✓', 'success');
  }

  // ── RESUMEN ──

  function _showSummary() {
    const elapsed = Math.round((Date.now() - _t0) / 60000);
    const total   = _ok + _ko;
    const ratings = _vals.map(v => v ? calcRating(v) : null).filter(r => r !== null);
    const avg     = ratings.length ? Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length) : 0;

    _set('summary-count', `${total} señal${total!==1?'es':''} evaluada${total!==1?'s':''}`);
    _set('summary-time',  `en ${elapsed||'<1'} minuto${elapsed!==1?'s':''}`);

    const stats = document.getElementById('summary-stats');
    if (stats) stats.innerHTML = `
      <div class="summary-stat-row"><span class="summary-stat-label">Validadas</span><span class="summary-stat-value">${_ok}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-label">Rechazadas</span><span class="summary-stat-value">${_ko}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-label">Rating medio</span><span class="summary-stat-value ${ratingClass(avg)}">${avg}</span></div>`;

    Screens.show('summary');
  }

  // ── HELPERS ──

  function _set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function _setDisabled(id, val) {
    const el = document.getElementById(id);
    if (el) el.disabled = val;
  }

  function getCurrentIndex()      { return _idx; }
  function getCurrentDetections() { return _dets; }

  return { startSession, validate, reject, openEditor, saveEditor, navigateTo, getCurrentIndex, getCurrentDetections };
})();
