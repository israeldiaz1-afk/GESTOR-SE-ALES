// ============================================================
// RoadSign Evaluator — utils/geo.js
// Geolocalización GPS
// ============================================================

const Geo = (() => {
  let _lastKnown = null;
  let _watchId   = null;
  let _listeners = [];

  function onUpdate(fn) { _listeners.push(fn); }

  function start() {
    if (!navigator.geolocation) {
      Logger.warn('Geolocalización no disponible');
      return;
    }
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        _lastKnown = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          precision: pos.coords.accuracy,
          altitude:  pos.coords.altitude,
          timestamp: new Date().toISOString(),
        };
        _listeners.forEach(fn => fn(_lastKnown));
      },
      err => {
        Logger.warn('GPS error:', err.message);
        // Mantener última ubicación conocida
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }

  function stop() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
  }

  function getOnce() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          precision: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        }),
        () => resolve(_lastKnown),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  function getLast() { return _lastKnown; }

  function formatCoords(loc) {
    if (!loc) return 'Sin ubicación';
    return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  }

  function toKMLPoint(loc, name, description = '') {
    if (!loc) return '';
    return `<Placemark><name>${name}</name><description>${description}</description>` +
           `<Point><coordinates>${loc.lng},${loc.lat},0</coordinates></Point></Placemark>`;
  }

  return { start, stop, getOnce, getLast, onUpdate, formatCoords, toKMLPoint };
})();

window.Geo = Geo;
