'use strict';
const Camera = (() => {
  let _stream = null;
  let _facingMode = 'environment';
  let _videoEl = null;

  async function start(videoEl) {
    _videoEl = videoEl;
    await _startStream();
  }

  async function _startStream() {
    // BUG6 FIX: detener tracks del stream anterior sin borrar _videoEl
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }

    const constraints = {
      video: {
        facingMode: { ideal: _facingMode },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    try {
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (_videoEl) {
        _videoEl.srcObject = _stream;
        // En iOS es necesario el atributo playsinline y llamar play()
        _videoEl.setAttribute('playsinline', '');
        _videoEl.setAttribute('muted', '');
        await _videoEl.play().catch(e => {
          // Autoplay puede fallar en algunos navegadores; ok si el vídeo arranca solo
          Logger.warn('Camera play():', e.message);
        });
      }
    } catch(e) {
      Logger.error('Camera getUserMedia:', e);
      // Mensaje específico según el error
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        throw new Error('Permiso de cámara denegado. Ve a Ajustes del navegador y permite el acceso.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        throw new Error('No se encontró cámara en este dispositivo.');
      } else if (e.name === 'NotReadableError') {
        throw new Error('La cámara está siendo usada por otra app. Ciérrala e inténtalo de nuevo.');
      } else {
        throw new Error(`Error de cámara: ${e.message}`);
      }
    }
  }

  // BUG6 FIX: flip no pierde _videoEl
  async function flip() {
    _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
    await _startStream();
  }

  function stop() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    // BUG6 FIX: NO borrar _videoEl — solo desconectar el stream
    if (_videoEl) {
      _videoEl.srcObject = null;
      _videoEl.load(); // resetear el elemento video
    }
  }

  function isActive() { return !!_stream; }
  function getFacingMode() { return _facingMode; }

  return { start, stop, flip, isActive, getFacingMode };
})();
