'use strict';
const Screens = (() => {
  let _current = null;
  const _stack = [];
  let _onLeaveCallback = null; // callback al salir de pantalla (ej: parar cámara)

  function show(id, pushHistory = true) {
    const next = document.getElementById(`screen-${id}`);
    if (!next) { console.warn('Screen not found:', id); return; }
    if (_current === next) return; // ya en esa pantalla

    // Guardar en stack ANTES de cambiar _current
    if (pushHistory && _current) {
      _stack.push(_current.id.replace('screen-', ''));
    }

    // Llamar callback de salida si existe
    if (_onLeaveCallback) {
      try { _onLeaveCallback(_current?.id?.replace('screen-', '')); } catch(e) {}
      _onLeaveCallback = null;
    }

    // Ocultar pantalla actual
    if (_current) {
      _current.classList.remove('active');
      const prev = _current;
      // Esperar a que termine la transición CSS antes de ocultar
      setTimeout(() => {
        if (prev !== _current) prev.style.display = 'none';
      }, 260);
    }

    // Mostrar nueva pantalla
    next.style.display = 'flex';
    // Forzar reflow para que la transición CSS funcione
    next.getBoundingClientRect();
    next.classList.add('active');
    _current = next;

    // Gestionar History API para botón back de Android
    if (pushHistory && id !== 'splash') {
      history.pushState({ screen: id }, '', '');
    }
  }

  function back() {
    if (_stack.length === 0) {
      show('home', false);
      return;
    }
    show(_stack.pop(), false);
  }

  // Registrar callback que se ejecuta al salir de la pantalla actual
  function onLeave(fn) { _onLeaveCallback = fn; }

  function getCurrent() { return _current?.id?.replace('screen-', ''); }

  function init() {
    // Interceptar botón back del navegador/Android
    window.addEventListener('popstate', (e) => {
      if (_stack.length > 0) {
        show(_stack.pop(), false);
      }
    });
    show('splash', false);
  }

  return { show, back, onLeave, getCurrent, init };
})();
