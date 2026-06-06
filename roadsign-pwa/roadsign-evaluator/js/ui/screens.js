'use strict';
/* ══════════════════════════════════════════
   SCREENS.JS — Navegación entre pantallas
   ══════════════════════════════════════════ */
const Screens = (() => {
  let _current = null;
  const _stack = [];

  function show(id, pushHistory = true) {
    const next = document.getElementById(`screen-${id}`);
    if (!next) { Logger.warn('Screen no encontrada:', id); return; }

    // Ocultar actual
    if (_current && _current !== next) {
      _current.classList.remove('active');
      _current.style.display = 'none';
    }

    if (pushHistory && _current) _stack.push(_current.id.replace('screen-', ''));

    next.style.display = 'flex';
    requestAnimationFrame(() => next.classList.add('active'));
    _current = next;
    Logger.debug('Pantalla:', id);
  }

  function back() {
    if (_stack.length === 0) { show('home', false); return; }
    show(_stack.pop(), false);
  }

  function getCurrent() { return _current?.id?.replace('screen-', ''); }

  function init() {
    // Pantalla inicial: splash
    show('splash', false);
  }

  return { show, back, getCurrent, init };
})();
