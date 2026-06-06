// ============================================================
// RoadSign Evaluator — db.js
// Gestión de IndexedDB (7 Object Stores)
// ============================================================

const DB = (() => {
  let _db = null;

  const STORES = {
    evaluations:    { keyPath: 'id', indexes: ['timestamp', 'userId', 'tipoSenal'] },
    images:         { keyPath: 'id', indexes: ['timestamp', 'hash'] },
    learning:       { keyPath: 'id', indexes: ['timestamp', 'senal'] },
    users:          { keyPath: 'id', indexes: ['nombre'] },
    models_state:   { keyPath: 'modelName' },
    catalogs:       { keyPath: 'tipo' },
    settings:       { keyPath: 'key' },
  };

  // ── Inicializar DB ────────────────────────────────────────
  function init() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }

      const req = indexedDB.open(RSConfig.DB_NAME, RSConfig.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const [name, cfg] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
            (cfg.indexes || []).forEach(idx => store.createIndex(idx, idx, { unique: false }));
          }
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Transacción helper ────────────────────────────────────
  function tx(storeName, mode = 'readonly') {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  // ── CRUD genérico ─────────────────────────────────────────
  function put(storeName, data) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function get(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function getAll(storeName, count) {
    return new Promise((resolve, reject) => {
      const req = count ? tx(storeName).getAll(null, count) : tx(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function del(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function count(storeName) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const idx = tx(storeName).index(indexName);
      const req  = idx.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Rango de fecha ────────────────────────────────────────
  function getByDateRange(storeName, from, to) {
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(from.toISOString(), to.toISOString());
      const idx   = tx(storeName).index('timestamp');
      const req   = idx.getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Limpieza ─────────────────────────────────────────────
  async function pruneOldest(storeName, keepCount) {
    const all = await getAll(storeName);
    if (all.length <= keepCount) return;
    all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    const toDelete = all.slice(0, all.length - keepCount);
    for (const item of toDelete) await del(storeName, item[STORES[storeName].keyPath]);
  }

  // ── Settings helpers ─────────────────────────────────────
  async function getSetting(key, defaultValue = null) {
    const row = await get('settings', key);
    return row ? row.value : defaultValue;
  }

  async function setSetting(key, value) {
    return put('settings', { key, value, timestamp: new Date().toISOString() });
  }

  // ── Stats ─────────────────────────────────────────────────
  async function getStats() {
    const [evalCount, imgCount, learnCount] = await Promise.all([
      count('evaluations'),
      count('images'),
      count('learning'),
    ]);
    return { evaluations: evalCount, images: imgCount, learningEvents: learnCount };
  }

  // ── Guardar evaluación ────────────────────────────────────
  async function saveEvaluation(evalData) {
    await pruneOldest('evaluations', RSConfig.STORAGE_LIMITS.maxEvaluations - 1);
    return put('evaluations', { ...evalData, timestamp: evalData.timestamp || new Date().toISOString() });
  }

  // ── Guardar imagen ────────────────────────────────────────
  async function saveImage(imgData) {
    await pruneOldest('images', RSConfig.STORAGE_LIMITS.maxImages - 1);
    return put('images', imgData);
  }

  // ── Guardar evento de aprendizaje ─────────────────────────
  async function saveLearningEvent(event) {
    await pruneOldest('learning', RSConfig.STORAGE_LIMITS.maxLearningEvents - 1);
    return put('learning', event);
  }

  return {
    init,
    put, get, getAll, del, count,
    getByIndex, getByDateRange,
    getSetting, setSetting, getStats,
    saveEvaluation, saveImage, saveLearningEvent,
  };
})();

window.DB = DB;
