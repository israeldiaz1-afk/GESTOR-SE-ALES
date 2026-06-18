'use strict';
/* ═══════════════════════════════════════════════════════════
   DEBUGPANEL.JS — Panel de diagnóstico en pantalla
   Captura console.log/warn/error y los muestra en un recuadro
   flotante dentro de la app, para depurar en el móvil sin cable.
   Se activa con un botón 🐞 fijo en la esquina.
   ═══════════════════════════════════════════════════════════ */
(function () {
  const MAX_LINES = 200;
  const lines = [];
  let panel = null, logBox = null, visible = false;

  // Guardar las funciones originales de consola
  const orig = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
    info:  console.info ? console.info.bind(console) : console.log.bind(console),
  };

  function fmt(args) {
    return args.map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
  }

  function add(type, args) {
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const text = `[${time}] ${fmt(args)}`;
    lines.push({ type, text });
    if (lines.length > MAX_LINES) lines.shift();
    render();
  }

  const debugEnabled = location.search.includes('debug');

  // Solo interceptar consola y capturar errores si el modo debug está activo
  if (debugEnabled) {
    console.log   = (...a) => { orig.log(...a);   add('log', a); };
    console.warn  = (...a) => { orig.warn(...a);  add('warn', a); };
    console.error = (...a) => { orig.error(...a); add('error', a); };
    console.info  = (...a) => { orig.info(...a);  add('info', a); };

    window.addEventListener('error', e => {
      add('error', [`JS ERROR: ${e.message} @ ${e.filename}:${e.lineno}`]);
    });
    window.addEventListener('unhandledrejection', e => {
      add('error', [`PROMISE ERROR: ${e.reason?.message || e.reason}`]);
    });
  }

  function render() {
    if (!logBox || !visible) return;
    logBox.innerHTML = lines.map(l => {
      const color = l.type === 'error' ? '#ff6b6b'
                  : l.type === 'warn'  ? '#ffd93d'
                  : l.type === 'info'  ? '#6bcBff'
                  : '#c8e6c9';
      const safe = l.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div style="color:${color};border-bottom:1px solid #222;padding:3px 0;word-break:break-all">${safe}</div>`;
    }).join('');
    logBox.scrollTop = logBox.scrollHeight;
  }

  function build() {
    // Botón flotante 🐞
    const btn = document.createElement('button');
    btn.textContent = '🐞';
    btn.style.cssText = 'position:fixed;bottom:80px;right:12px;z-index:99999;width:48px;height:48px;border-radius:50%;border:none;background:#1a2235;color:#fff;font-size:22px;box-shadow:0 2px 8px rgba(0,0,0,.5);';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    // Panel
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.94);display:none;flex-direction:column;padding:12px;box-sizing:border-box;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;flex-shrink:0;';
    header.innerHTML = '<strong style="color:#f5c518;font-family:sans-serif;flex:1">Diagnóstico</strong>';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Copiar';
    btnCopy.style.cssText = 'background:#22c55e;color:#000;border:none;padding:8px 14px;border-radius:6px;font-weight:700;';
    btnCopy.onclick = copyAll;

    const btnClear = document.createElement('button');
    btnClear.textContent = 'Limpiar';
    btnClear.style.cssText = 'background:#444;color:#fff;border:none;padding:8px 14px;border-radius:6px;';
    btnClear.onclick = () => { lines.length = 0; render(); };

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-weight:700;';
    btnClose.onclick = toggle;

    header.appendChild(btnCopy);
    header.appendChild(btnClear);
    header.appendChild(btnClose);

    logBox = document.createElement('div');
    logBox.style.cssText = 'flex:1;overflow-y:auto;background:#0a0e1a;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;line-height:1.5;';

    panel.appendChild(header);
    panel.appendChild(logBox);
    document.body.appendChild(panel);
  }

  function toggle() {
    visible = !visible;
    panel.style.display = visible ? 'flex' : 'none';
    render();
  }

  function copyAll() {
    const text = lines.map(l => l.text).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => alert('Diagnóstico copiado. Pégalo en el chat.'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); alert('Diagnóstico copiado.'); }
    catch { alert('No se pudo copiar automáticamente. Haz captura de pantalla.'); }
    ta.remove();
  }

  // El panel de diagnóstico solo se activa si la URL incluye ?debug
  // (ej. https://...pages.dev/?debug). En uso normal queda oculto.
  if (debugEnabled) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', build);
    } else {
      build();
    }
    console.log('[DebugPanel] activo — añade ?debug a la URL para verlo');
  }
})();
