/**
 * RoadSign Database Manager
 * Maneja todas las operaciones con IndexedDB
 */

class RoadsignDB {
    constructor() {
        this.dbName = 'RoadSignDB';
        this.version = 1;
        this.db = null;
        this.isReady = false;
    }

    /**
     * Inicializar la base de datos
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('[DB] Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('[DB] Upgrading database schema...');
                this.createObjectStores(db);
            };
        });
    }

    /**
     * Crear Object Stores
     */
    createObjectStores(db) {
        // 1. Evaluaciones
        if (!db.objectStoreNames.contains('evaluations')) {
            const evalStore = db.createObjectStore('evaluations', { keyPath: 'id' });
            evalStore.createIndex('timestamp', 'timestamp', { unique: false });
            evalStore.createIndex('latitude', 'location.latitude', { unique: false });
            evalStore.createIndex('longitude', 'location.longitude', { unique: false });
            evalStore.createIndex('signalType', 'signal.type', { unique: false });
            evalStore.createIndex('zoneId', 'geometry.zoneId', { unique: false });
            evalStore.createIndex('streetName', 'geometry.streetName', { unique: false });
            evalStore.createIndex('sessionId', 'metadata.sessionId', { unique: false });
            console.log('[DB] Created "evaluations" store');
        }

        // 2. Sesiones
        if (!db.objectStoreNames.contains('sessions')) {
            const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
            sessionStore.createIndex('startTime', 'startTime', { unique: false });
            sessionStore.createIndex('captureMode', 'captureMode', { unique: false });
            console.log('[DB] Created "sessions" store');
        }

        // 3. Zonas (Polígonos)
        if (!db.objectStoreNames.contains('zones')) {
            const zoneStore = db.createObjectStore('zones', { keyPath: 'id' });
            zoneStore.createIndex('name', 'name', { unique: false });
            console.log('[DB] Created "zones" store');
        }

        // 4. Calles
        if (!db.objectStoreNames.contains('streets')) {
            const streetStore = db.createObjectStore('streets', { keyPath: 'code' });
            streetStore.createIndex('zoneId', 'zoneId', { unique: false });
            streetStore.createIndex('name', 'name', { unique: false });
            console.log('[DB] Created "streets" store');
        }

        // 5. Pesos de Aprendizaje
        if (!db.objectStoreNames.contains('learningWeights')) {
            const weightsStore = db.createObjectStore('learningWeights', { keyPath: 'parameterId' });
            weightsStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
            console.log('[DB] Created "learningWeights" store');
        }

        // 6. Definiciones de Parámetros
        if (!db.objectStoreNames.contains('parameterDefinitions')) {
            const paramStore = db.createObjectStore('parameterDefinitions', { keyPath: 'id' });
            paramStore.createIndex('name', 'name', { unique: false });
            paramStore.createIndex('active', 'active', { unique: false });
            console.log('[DB] Created "parameterDefinitions" store');
        }

        // 7. Historial de Reportes
        if (!db.objectStoreNames.contains('reportHistory')) {
            const reportStore = db.createObjectStore('reportHistory', { keyPath: 'id' });
            reportStore.createIndex('timestamp', 'timestamp', { unique: false });
            reportStore.createIndex('zoneId', 'zoneId', { unique: false });
            reportStore.createIndex('signalType', 'signalType', { unique: false });
            console.log('[DB] Created "reportHistory" store');
        }
    }

    /**
     * Operación genérica en una transacción
     */
    async transaction(storeName, mode = 'readonly', callback) {
        if (!this.isReady) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, mode);
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    reject(transaction.error);
                };

                transaction.oncomplete = () => {
                    // La transacción se completó
                };

                const result = callback(store);

                if (result instanceof IDBRequest) {
                    result.onsuccess = () => {
                        resolve(result.result);
                    };
                    result.onerror = () => {
                        reject(result.error);
                    };
                } else {
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /* ======== EVALUACIONES ======== */

    async saveEvaluation(evaluation) {
        evaluation.id = evaluation.id || `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        evaluation.timestamp = evaluation.timestamp || Date.now();

        return this.transaction('evaluations', 'readwrite', (store) => {
            return store.put(evaluation);
        });
    }

    async getEvaluation(id) {
        return this.transaction('evaluations', 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getAllEvaluations() {
        return this.transaction('evaluations', 'readonly', (store) => {
            return store.getAll();
        });
    }

    async getEvaluationsBySession(sessionId) {
        return this.transaction('evaluations', 'readonly', (store) => {
            return store.index('sessionId').getAll(sessionId);
        });
    }

    async getEvaluationsByZone(zoneId) {
        return this.transaction('evaluations', 'readonly', (store) => {
            return store.index('zoneId').getAll(zoneId);
        });
    }

    async deleteEvaluation(id) {
        return this.transaction('evaluations', 'readwrite', (store) => {
            return store.delete(id);
        });
    }

    /* ======== SESIONES ======== */

    async saveSession(session) {
        session.id = session.id || `session_${Date.now()}`;

        return this.transaction('sessions', 'readwrite', (store) => {
            return store.put(session);
        });
    }

    async getSession(id) {
        return this.transaction('sessions', 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getAllSessions() {
        return this.transaction('sessions', 'readonly', (store) => {
            return store.getAll();
        });
    }

    async getLatestSession() {
        return this.transaction('sessions', 'readonly', (store) => {
            return store.index('startTime').getAll();
        }).then((sessions) => {
            return sessions.length > 0 ? sessions[sessions.length - 1] : null;
        });
    }

    /* ======== ZONAS ======== */

    async saveZone(zone) {
        return this.transaction('zones', 'readwrite', (store) => {
            return store.put(zone);
        });
    }

    async getZone(id) {
        return this.transaction('zones', 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getAllZones() {
        return this.transaction('zones', 'readonly', (store) => {
            return store.getAll();
        });
    }

    async updateZoneCoverage(zoneId, coverage) {
        const zone = await this.getZone(zoneId);
        if (zone) {
            zone.coverage = coverage;
            return this.saveZone(zone);
        }
    }

    /* ======== CALLES ======== */

    async saveStreet(street) {
        return this.transaction('streets', 'readwrite', (store) => {
            return store.put(street);
        });
    }

    async getStreet(code) {
        return this.transaction('streets', 'readonly', (store) => {
            return store.get(code);
        });
    }

    async getStreetsByZone(zoneId) {
        return this.transaction('streets', 'readonly', (store) => {
            return store.index('zoneId').getAll(zoneId);
        });
    }

    async getAllStreets() {
        return this.transaction('streets', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /* ======== PESOS DE APRENDIZAJE ======== */

    async saveWeight(weight) {
        return this.transaction('learningWeights', 'readwrite', (store) => {
            return store.put(weight);
        });
    }

    async getWeight(parameterId) {
        return this.transaction('learningWeights', 'readonly', (store) => {
            return store.get(parameterId);
        });
    }

    async getAllWeights() {
        return this.transaction('learningWeights', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /* ======== PARÁMETROS ======== */

    async saveParameter(parameter) {
        return this.transaction('parameterDefinitions', 'readwrite', (store) => {
            return store.put(parameter);
        });
    }

    async getParameter(id) {
        return this.transaction('parameterDefinitions', 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getAllParameters() {
        return this.transaction('parameterDefinitions', 'readonly', (store) => {
            return store.getAll();
        });
    }

    async getActiveParameters() {
        return this.getAllParameters().then((params) => {
            return params.filter((p) => p.active);
        });
    }

    /* ======== REPORTES ======== */

    async saveReport(report) {
        report.id = report.id || `report_${Date.now()}`;

        return this.transaction('reportHistory', 'readwrite', (store) => {
            return store.put(report);
        });
    }

    async getReport(id) {
        return this.transaction('reportHistory', 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getReportsByZone(zoneId) {
        return this.transaction('reportHistory', 'readonly', (store) => {
            return store.index('zoneId').getAll(zoneId);
        });
    }

    async getAllReports() {
        return this.transaction('reportHistory', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /* ======== UTILIDADES ======== */

    async clearAll() {
        const stores = [
            'evaluations',
            'sessions',
            'zones',
            'streets',
            'learningWeights',
            'parameterDefinitions',
            'reportHistory'
        ];

        for (const storeName of stores) {
            await this.transaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }

        console.log('[DB] All stores cleared');
    }

    async getStats() {
        const stats = {
            evaluations: 0,
            sessions: 0,
            zones: 0,
            streets: 0
        };

        stats.evaluations = (await this.getAllEvaluations()).length;
        stats.sessions = (await this.getAllSessions()).length;
        stats.zones = (await this.getAllZones()).length;
        stats.streets = (await this.getAllStreets()).length;

        return stats;
    }
}

// Crear instancia global de la base de datos
const roadsignDB = new RoadsignDB();

// Inicializar al cargar el script
roadsignDB.init().catch((error) => {
    console.error('[DB] Initialization error:', error);
});

console.log('[DB] Module loaded');
