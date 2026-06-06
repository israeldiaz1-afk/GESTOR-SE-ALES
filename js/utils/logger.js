// ============================================================
// RoadSign Evaluator — utils/logger.js
// Logging, UUID y utilidades generales
// ============================================================

const Logger = (() => {
  const PREFIX = '[RoadSign]';
  const isDev  = () => location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  return {
    info:  (...a) => isDev() && console.log(`${PREFIX} ℹ️`,  ...a),
    warn:  (...a) =>             console.warn(`${PREFIX} ⚠️`, ...a),
    error: (...a) =>             console.error(`${PREFIX} ❌`,...a),
    debug: (...a) => isDev() && console.debug(`${PREFIX} 🔍`,...a),
    perf:  (label, fn) => {
      if (!isDev()) return fn();
      const t = performance.now();
      const r = fn();
      console.log(`${PREFIX} ⏱️ ${label}: ${(performance.now()-t).toFixed(1)}ms`);
      return r;
    },
  };
})();

// ── UUID v4 ───────────────────────────────────────────────────
function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Formateo de fechas ────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

// ── Throttle ──────────────────────────────────────────────────
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

// ── Debounce ──────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── Clamp ─────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── Formateo de rating ────────────────────────────────────────
function ratingToStars(rating) {
  const stars = Math.round(rating * 5);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function ratingLabel(rating) {
  if (rating >= 0.9) return { text: 'Excelente', cls: 'rating-excellent' };
  if (rating >= 0.7) return { text: 'Bueno',     cls: 'rating-good'      };
  if (rating >= 0.5) return { text: 'Regular',   cls: 'rating-fair'      };
  if (rating >= 0.3) return { text: 'Malo',      cls: 'rating-poor'      };
  return                     { text: 'Crítico',   cls: 'rating-critical'  };
}

window.Logger      = Logger;
window.generateUUID = generateUUID;
window.formatDate   = formatDate;
window.formatDateTime = formatDateTime;
window.throttle    = throttle;
window.debounce    = debounce;
window.clamp       = clamp;
window.ratingToStars = ratingToStars;
window.ratingLabel   = ratingLabel;
