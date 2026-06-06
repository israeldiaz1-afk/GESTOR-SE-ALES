/**
 * RoadSign Modes Manager
 * Maneja auto-detección de modo conducción vs foto/barrido
 */

class ModesManager {
    constructor() {
        this.selectedMode = null;
        this.currentMode = null;
        this.modeHistory = [];
        this.gpsThreshold = 5; // metros por segundo = 18 km/h
        this.checkInterval = 3000; // 3 segundos
        this.isMonitoring = false;
        this.lastGPSPosition = null;
        this.lastGPSTime = null;
    }

    /**
     * Inicializar el gestor de modos
     */
    init() {
        this.attachModeSelector();
        console.log('[Modes] Manager initialized');
    }

    /**
     * Adjuntar listeners al selector de modo
     */
    attachModeSelector() {
        const modes = ['driving', 'static', 'auto'];

        modes.forEach((mode) => {
            const modeCard = document.getElementById(`mode-${mode}`);
            if (modeCard) {
                modeCard.addEventListener('click', () => {
                    this.selectMode(mode);
                });
            }
        });

        const startButton = document.getElementById('btn-start-session');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.startSession();
            });
        }
    }

    /**
     * Seleccionar modo manualmente
     */
    selectMode(mode) {
        // Deseleccionar todos
        document.querySelectorAll('.mode-card').forEach((card) => {
            card.classList.remove('selected');
        });

        // Seleccionar el nuevo modo
        const modeCard = document.getElementById(`mode-${mode}`);
        if (modeCard) {
            modeCard.classList.add('selected');
        }

        this.selectedMode = mode;

        // Habilitar botón de inicio
        const startButton = document.getElementById('btn-start-session');
        if (startButton) {
            startButton.disabled = false;
        }

        // Actualizar texto
        const selectedText = document.getElementById('mode-selected-text');
        if (selectedText) {
            const modeNames = {
                'driving': 'Modo conducción seleccionado',
                'static': 'Modo foto/barrido seleccionado',
                'auto': 'Auto-detección activada'
            };
            selectedText.textContent = modeNames[mode] || 'Modo seleccionado';
        }

        console.log('[Modes] Selected mode:', mode);
    }

    /**
     * Iniciar sesión con el modo seleccionado
     */
    startSession() {
        if (!this.selectedMode) {
            alert('Por favor selecciona un modo');
            return;
        }

        console.log('[Modes] Starting session with mode:', this.selectedMode);

        // Crear sesión
        const session = {
            id: `session_${Date.now()}`,
            startTime: Date.now(),
            captureMode: this.selectedMode,
            totalEvaluations: 0,
            zoneCoverage: {},
            statistics: {
                byRating: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
                byType: { 'vertical': 0, 'horizontal': 0 },
                byZone: {},
                byStreet: {}
            },
            learningMetrics: {
                userChangedRatings: 0,
                confirmationRate: 0,
                averageConfidence: 0
            }
        };

        // Guardar sesión en DB
        roadsignDB.saveSession(session).then(() => {
            window.currentSession = session;

            // Ir a pantalla de captura
            this.switchToCapture();

            // Si es auto-detección, empezar a monitorear GPS
            if (this.selectedMode === 'auto') {
                this.startAutoDetection();
            } else if (this.selectedMode === 'driving') {
                this.currentMode = 'driving';
                this.updateCaptureModeDisplay();
            } else if (this.selectedMode === 'static') {
                this.currentMode = 'static';
                this.updateCaptureModeDisplay();
            }
        });
    }

    /**
     * Cambiar a pantalla de captura
     */
    switchToCapture() {
        // Ocultar selector de modo
        const modeScreen = document.getElementById('screen-mode-selector');
        if (modeScreen) {
            modeScreen.classList.remove('active');
        }

        // Mostrar captura
        const captureScreen = document.getElementById('screen-capture');
        if (captureScreen) {
            captureScreen.classList.add('active');
        }
    }

    /**
     * Auto-detectar modo basado en GPS
     */
    startAutoDetection() {
        if (!navigator.geolocation) {
            console.error('[Modes] Geolocation not available');
            this.currentMode = 'static';
            return;
        }

        this.isMonitoring = true;
        console.log('[Modes] Starting auto-detection...');

        // Obtener posición cada 3 segundos
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.analyzeGPSData(position);
            },
            (error) => {
                console.error('[Modes] Geolocation error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    /**
     * Analizar datos de GPS para detectar movimiento
     */
    analyzeGPSData(position) {
        const { latitude, longitude, speed, timestamp } = position.coords;

        if (!this.lastGPSPosition) {
            this.lastGPSPosition = { latitude, longitude, timestamp };
            this.updateDetectionUI();
            return;
        }

        // Calcular velocidad si no viene en los datos
        let currentSpeed = speed;

        if (!currentSpeed || currentSpeed === null) {
            const distance = this.calculateDistance(
                this.lastGPSPosition.latitude,
                this.lastGPSPosition.longitude,
                latitude,
                longitude
            );

            const timeDiff = (timestamp - this.lastGPSPosition.timestamp) / 1000; // en segundos
            currentSpeed = timeDiff > 0 ? distance / timeDiff : 0;
        }

        // Determinar modo
        const wasMoving = this.currentMode === 'driving';
        const isMoving = currentSpeed > this.gpsThreshold;

        if (isMoving && !wasMoving) {
            this.currentMode = 'driving';
            this.currentSpeed = currentSpeed;
            console.log('[Modes] Detected driving mode - Speed:', currentSpeed.toFixed(2), 'm/s');
            this.updateDetectionUI();
        } else if (!isMoving && wasMoving) {
            this.currentMode = 'static';
            this.currentSpeed = 0;
            console.log('[Modes] Detected static mode');
            this.updateDetectionUI();
        }

        // Actualizar última posición
        this.lastGPSPosition = { latitude, longitude, timestamp };
    }

    /**
     * Calcular distancia entre dos puntos (Fórmula de Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radio de la Tierra en metros
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distancia en metros
    }

    /**
     * Actualizar UI con el modo detectado
     */
    updateDetectionUI() {
        if (this.currentMode) {
            this.updateCaptureModeDisplay();
        }
    }

    /**
     * Actualizar pantalla de captura con el modo actual
     */
    updateCaptureModeDisplay() {
        const modeTitle = document.getElementById('capture-mode-title');
        if (modeTitle) {
            const modeNames = {
                'driving': '🚗 Modo Conducción',
                'static': '📸 Modo Foto/Barrido',
                'auto': '🔄 Auto-Detectando'
            };
            modeTitle.textContent = modeNames[this.currentMode] || this.currentMode;
        }
    }

    /**
     * Obtener modo actual
     */
    getCurrentMode() {
        return this.currentMode || this.selectedMode;
    }

    /**
     * Obtener modo seleccionado
     */
    getSelectedMode() {
        return this.selectedMode;
    }

    /**
     * Detener monitoreo de GPS
     */
    stopAutoDetection() {
        if (this.watchId !== undefined) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        this.isMonitoring = false;
        console.log('[Modes] Auto-detection stopped');
    }

    /**
     * Detener sesión
     */
    stopSession() {
        this.stopAutoDetection();

        if (window.currentSession) {
            window.currentSession.endTime = Date.now();
            roadsignDB.saveSession(window.currentSession);
        }

        console.log('[Modes] Session stopped');
    }

    /**
     * Registrar cambio de modo
     */
    recordModeChange(fromMode, toMode) {
        this.modeHistory.push({
            from: fromMode,
            to: toMode,
            timestamp: Date.now()
        });

        console.log('[Modes] Mode changed from', fromMode, 'to', toMode);
    }

    /**
     * Obtener historial de cambios de modo
     */
    getModeHistory() {
        return this.modeHistory;
    }
}

// Crear instancia global del gestor de modos
const modesManager = new ModesManager();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    modesManager.init();
});

console.log('[Modes] Module loaded');
