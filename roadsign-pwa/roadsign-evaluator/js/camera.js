'use strict';
/* ══════════════════════════════════
   CAMERA.JS — Gestión de cámara
   ══════════════════════════════════ */
const Camera = (() => {
  let _stream = null;
  let _facingMode = APP_CONFIG.camera.facingMode;
  let _videoEl = null;

  async function start(videoEl) {
    _videoEl = videoEl;
    await _startStream();
  }

  async function _startStream() {
    if (_stream) stop();
    const constraints = {
      video: {
        facingMode: { ideal: _facingMode },
        width:  { ideal: APP_CONFIG.camera.idealWidth },
        height: { ideal: APP_CONFIG.camera.idealHeight },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };
    try {
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (_videoEl) {
        _videoEl.srcObject = _stream;
        await _videoEl.play();
      }
      Logger.info('Cámara iniciada:', _facingMode);
    } catch (e) {
      Logger.error('Error accediendo a cámara:', e);
      throw new Error('No se pudo acceder a la cámara. Revisa los permisos.');
    }
  }

  async function flip() {
    _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
    await _startStream();
  }

  function stop() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    if (_videoEl) _videoEl.srcObject = null;
  }

  function isActive() { return !!_stream; }
  function getFacingMode() { return _facingMode; }

  return { start, stop, flip, isActive, getFacingMode };
})();
