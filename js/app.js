/**
 * RoadSign Evaluator - Main Application
 * Lógica principal de la aplicación
 */

class RoadSignApp {
    constructor() {
        this.currentSession = null;
        this.currentEvaluation = null;
        this.isInitialized = false;
    }

    /**
     * Inicializar la aplicación
     */
    async init() {
        try {
            console.log('[App] Initializing RoadSign Evaluator with FASE 2...');

            // Esperar a que IndexedDB esté listo
            await roadsignDB.init();
            console.log('[App] Database initialized');

            // FASE 2: Inicializar parámetros
            if (typeof parametersManager !== 'undefined') {
                await parametersManager.init();
                console.log('[App] Parameters manager initialized');
            }

            // FASE 2: Inicializar heurísticas
            if (typeof heuristicsEngine !== 'undefined') {
                await heuristicsEngine.init();
                console.log('[App] Heuristics engine initialized');
            }

            // FASE 2: Inicializar UI de parámetros
            if (typeof parametersUIManager !== 'undefined') {
                await parametersUIManager.init();
                console.log('[App] Parameters UI manager initialized');
            }

            // Inicializar gestor de modos
            modesManager.init();
            console.log('[App] Modes manager initialized');

            // Configurar listeners
            this.setupEventListeners();
            this.setupPhase2Listeners();

            // Configurar theme
            this.setupTheme();

            // Cargar sesión anterior si existe
            await this.loadPreviousSession();

            this.isInitialized = true;
            console.log('[App] Initialization complete');
        } catch (error) {
            console.error('[App] Initialization error:', error);
        }
    }

    /**
     * Configurar listeners de eventos
     */
    setupEventListeners() {
        // Navegación entre pantallas
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const screenId = btn.getAttribute('data-screen');
                if (screenId) {
                    this.switchScreen(screenId);
                }
            });
        });

        // Botón atrás
        const backButton = document.getElementById('btn-back-home');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.switchScreen('home');
                cameraManager.stopStream();
                modesManager.stopSession();
            });
        }

        // Botón nueva sesión desde home
        const newSessionBtn = document.getElementById('btn-new-session-home');
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => {
                this.switchScreen('mode-selector');
            });
        }

        // Botón dashboard
        const dashboardBtn = document.getElementById('btn-dashboard');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                this.switchScreen('dashboard');
            });
        }

        // Botón evaluaciones
        const evaluationsBtn = document.getElementById('btn-evaluations');
        if (evaluationsBtn) {
            evaluationsBtn.addEventListener('click', () => {
                this.switchScreen('evaluations');
            });
        }

        // Cerrar modal
        const closeModalBtn = document.getElementById('btn-close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeEvaluationModal();
            });
        }

        // Guardar evaluación
        const saveEvalBtn = document.getElementById('btn-save-evaluation');
        if (saveEvalBtn) {
            saveEvalBtn.addEventListener('click', () => {
                this.saveEvaluation();
            });
        }

        console.log('[App] Event listeners configured');
    }

    /**
     * Configurar listeners de FASE 2
     */
    setupPhase2Listeners() {
        // Botón de configuración
        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.switchScreen('settings');
            });
        }

        // Botón atrás en configuración
        const backSettingsBtn = document.getElementById('btn-back-settings');
        if (backSettingsBtn) {
            backSettingsBtn.addEventListener('click', () => {
                this.switchScreen('home');
            });
        }

        // Botón resetear aprendizaje
        const resetLearningBtn = document.getElementById('btn-reset-learning');
        if (resetLearningBtn) {
            resetLearningBtn.addEventListener('click', () => {
                this.resetLearning();
            });
        }

        console.log('[App] FASE 2 listeners configured');
    }

    /**
     * Cambiar entre pantallas
     */
    switchScreen(screenId) {
        // Ocultar todas las pantallas
        document.querySelectorAll('.screen').forEach((screen) => {
            screen.classList.remove('active');
        });

        // Mostrar la pantalla solicitada
        let screen;
        
        if (screenId === 'mode-selector') {
            screen = document.getElementById('screen-mode-selector');
        } else if (screenId === 'home') {
            screen = document.getElementById('screen-home');
            this.updateHomeScreen();
        } else if (screenId === 'capture') {
            screen = document.getElementById('screen-capture');
        } else if (screenId === 'dashboard') {
            screen = document.getElementById('screen-dashboard');
            // TODO: Renderizar dashboard
        } else if (screenId === 'evaluations') {
            screen = document.getElementById('screen-evaluations');
            // TODO: Listar evaluaciones
        } else if (screenId === 'settings') {
            screen = document.getElementById('screen-settings');
            this.updateSettingsScreen();
        }

        if (screen) {
            screen.classList.add('active');
            console.log('[App] Switched to screen:', screenId);
        } else {
            console.warn('[App] Screen not found:', screenId);
        }

        // Actualizar nav buttons
        document.querySelectorAll('.nav-btn').forEach((btn) => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-screen') === screenId) {
                btn.classList.add('active');
            }
        });
    }

    /**
     * Actualizar pantalla de inicio
     */
    async updateHomeScreen() {
        const session = await roadsignDB.getLatestSession();

        if (session) {
            const summaryCard = document.getElementById('session-summary-card');
            if (summaryCard) {
                const duration = new Date(session.endTime - session.startTime).toLocaleTimeString();
                const zoneCount = Object.keys(session.zoneCoverage).length;

                summaryCard.innerHTML = `
                    <h2>Última Sesión</h2>
                    <div class="summary-stats">
                        <div class="summary-stat">
                            <span class="stat-value">${session.totalEvaluations}</span>
                            <span class="stat-label">Evaluaciones</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${zoneCount}</span>
                            <span class="stat-label">Zonas</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${duration}</span>
                            <span class="stat-label">Tiempo</span>
                        </div>
                    </div>
                `;
            }
        }

        // Actualizar alertas de cobertura
        this.updateZoneCoverageAlerts();
    }

    /**
     * Actualizar alertas de cobertura de zonas
     */
    async updateZoneCoverageAlerts() {
        const zones = await roadsignDB.getAllZones();
        const alertsContainer = document.getElementById('zone-alerts-container');

        if (!alertsContainer) return;

        const readyZones = zones.filter((zone) => zone.coverage?.reachedThreshold50);

        if (readyZones.length > 0) {
            let html = '<div class="zone-alerts"><h3>⭐ Zonas Listas para Reportar</h3>';

            readyZones.forEach((zone) => {
                const percentage = zone.coverage?.percentageCovered || 0;
                html += `
                    <div class="alert-badge">
                        <span>${zone.name} - ${percentage}% cubierto</span>
                        <button class="btn btn-sm btn-primary" onclick="app.generateZoneReport('${zone.id}')">
                            Generar Reporte
                        </button>
                    </div>
                `;
            });

            html += '</div>';
            alertsContainer.innerHTML = html;
        } else {
            alertsContainer.innerHTML = '';
        }
    }

    /**
     * Abrir modal de evaluación
     */
    openEvaluationModal(signalData) {
        this.currentEvaluation = {
            signal: signalData,
            timestamp: Date.now(),
            photos: []
        };

        // Rellenar datos en el modal
        document.getElementById('eval-signal-name').textContent = signalData.description || '-';
        document.getElementById('eval-location').textContent =
            `${signalData.zone || '-'} / ${signalData.street || '-'}`;
        document.getElementById('eval-time').textContent = new Date().toLocaleString();
        document.getElementById('eval-mode').textContent = modesManager.getCurrentMode() || '-';

        // Mostrar modal
        const modal = document.getElementById('modal-evaluation');
        if (modal) {
            modal.classList.remove('hidden');
        }

        console.log('[App] Evaluation modal opened');
    }

    /**
     * Cerrar modal de evaluación
     */
    closeEvaluationModal() {
        const modal = document.getElementById('modal-evaluation');
        if (modal) {
            modal.classList.add('hidden');
        }

        this.currentEvaluation = null;
        console.log('[App] Evaluation modal closed');
    }

    /**
     * Guardar evaluación
     */
    async saveEvaluation() {
        if (!this.currentEvaluation) {
            console.error('[App] No evaluation to save');
            return;
        }

        // Obtener datos del formulario
        const rating = document.querySelector('input[name="rating"]:checked');
        const damages = Array.from(document.querySelectorAll('input[name="damage"]:checked')).map(
            (el) => el.value
        );
        const weather = document.querySelector('input[name="weather"]:checked');
        const comments = document.getElementById('eval-comments').value;

        if (!rating) {
            alert('Por favor selecciona una calificación');
            return;
        }

        // Crear objeto de evaluación
        const evaluation = {
            timestamp: Date.now(),
            captureMode: modesManager.getCurrentMode(),
            location: {
                latitude: 0,
                longitude: 0,
                accuracy: 0
            },
            signal: this.currentEvaluation.signal,
            condition: {
                rating: parseInt(rating.value),
                aiSuggestion: 'Good',
                userConfirmed: true,
                userChangedRating: false,
                confidence: 0.85
            },
            parameters: {
                activeModules: ['base'],
                base: {
                    damageType: damages,
                    weatherCondition: weather?.value || 'sunny',
                    visibility: 'clear'
                }
            },
            details: {
                userComments: comments,
                photos: this.currentEvaluation.photos
            },
            metadata: {
                sessionId: window.currentSession?.id || null,
                deviceInfo: navigator.userAgent.substring(0, 50),
                modelVersion: 'v1.0'
            }
        };

        // Obtener coordenadas GPS
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    evaluation.location.latitude = position.coords.latitude;
                    evaluation.location.longitude = position.coords.longitude;
                    evaluation.location.accuracy = position.coords.accuracy;

                    this.saveEvaluationToDb(evaluation);
                },
                (error) => {
                    console.warn('[App] GPS error:', error);
                    this.saveEvaluationToDb(evaluation);
                }
            );
        } else {
            this.saveEvaluationToDb(evaluation);
        }
    }

    /**
     * Guardar evaluación en base de datos
     */
    async saveEvaluationToDb(evaluation) {
        try {
            await roadsignDB.saveEvaluation(evaluation);

            // Actualizar sesión
            if (window.currentSession) {
                window.currentSession.totalEvaluations++;
                await roadsignDB.saveSession(window.currentSession);
            }

            // Cerrar modal
            this.closeEvaluationModal();

            // Mostrar confirmación
            this.showNotification('✅ Evaluación guardada');

            // Limpiar formulario
            document.querySelector('form')?.reset?.();

            console.log('[App] Evaluation saved successfully');
        } catch (error) {
            console.error('[App] Error saving evaluation:', error);
            this.showNotification('❌ Error al guardar');
        }
    }

    /**
     * Cargar sesión anterior
     */
    async loadPreviousSession() {
        const session = await roadsignDB.getLatestSession();
        if (session && !session.endTime) {
            window.currentSession = session;
            console.log('[App] Loaded previous session');
        }
    }

    /**
     * Generar reporte de zona
     */
    generateZoneReport(zoneId) {
        console.log('[App] Generating report for zone:', zoneId);
        // TODO: Implementar generación de reporte
        this.showNotification('📊 Generando reporte...');
    }

    /**
     * Mostrar notificación
     */
    showNotification(message, duration = 3000) {
        // TODO: Implementar notificaciones
        console.log('[App] Notification:', message);
    }

    /**
     * Configurar tema
     */
    setupTheme() {
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = isDarkMode ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
        });

        console.log('[App] Theme set to:', theme);
    }

    /**
     * Actualizar pantalla de configuración (FASE 2)
     */
    async updateSettingsScreen() {
        const container = document.getElementById('parameters-settings-container');
        if (!container) return;

        try {
            if (typeof parametersUIManager !== 'undefined') {
                const settingsHTML = parametersUIManager.generateSettingsScreen();
                container.innerHTML = settingsHTML;
                await this.updateLearningStats();
                console.log('[App] Settings screen updated');
            }
        } catch (error) {
            console.error('[App] Error updating settings:', error);
        }
    }

    /**
     * Actualizar estadísticas de aprendizaje (FASE 2)
     */
    async updateLearningStats() {
        try {
            if (typeof heuristicsEngine === 'undefined') return;
            
            const improvements = await heuristicsEngine.getPrecisionImprovement();
            if (!improvements) return;

            const confirmationsEl = document.getElementById('learning-confirmations');
            if (confirmationsEl) {
                confirmationsEl.textContent = improvements.totalWeights || 0;
            }

            const accuracyEl = document.getElementById('learning-accuracy');
            if (accuracyEl) {
                const accuracy = (improvements.averageAccuracy * 100).toFixed(0);
                accuracyEl.textContent = accuracy + '%';
            }

            const improvementEl = document.getElementById('learning-improvement');
            if (improvementEl) {
                improvementEl.textContent = (improvements.totalAdjustment > 0 ? '+' : '') + 
                                           improvements.totalAdjustment.toFixed(2);
            }

            console.log('[App] Learning stats updated:', improvements);
        } catch (error) {
            console.error('[App] Error updating learning stats:', error);
        }
    }

    /**
     * Resetear aprendizaje (FASE 2)
     */
    async resetLearning() {
        const confirmed = confirm('¿Estás seguro? Esto reiniciará todos los pesos aprendidos.');
        if (!confirmed) return;

        try {
            if (typeof heuristicsEngine !== 'undefined') {
                await heuristicsEngine.init();
                await this.updateLearningStats();
                this.showNotification('✅ Aprendizaje reseteado');
                console.log('[App] Learning reset complete');
            }
        } catch (error) {
            console.error('[App] Error resetting learning:', error);
            this.showNotification('❌ Error al resetear');
        }
    }

    /**
     * NUEVO: Exportar histórico de aprendizaje como CSV
     */
    exportLearningHistoryCSV() {
        try {
            if (typeof heuristicsEngine === 'undefined') return;

            const history = heuristicsEngine.getFormattedHistory();
            if (history.length === 0) {
                alert('No hay histórico de aprendizaje para exportar');
                return;
            }

            // Crear CSV
            const headers = Object.keys(history[0]);
            const csvContent = [
                headers.join(','),
                ...history.map(row => 
                    headers.map(header => `"${row[header]}"`).join(',')
                )
            ].join('\n');

            // Descargar
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `learning_history_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();

            console.log('[App] Learning history exported as CSV');
            this.showNotification('📥 Histórico exportado como CSV');
        } catch (error) {
            console.error('[App] Error exporting CSV:', error);
            this.showNotification('❌ Error al exportar');
        }
    }

    /**
     * NUEVO: Exportar estadísticas de aprendizaje como JSON
     */
    exportLearningStatsJSON() {
        try {
            if (typeof heuristicsEngine === 'undefined') return;

            const stats = heuristicsEngine.getLearningStats();
            const data = {
                exportDate: new Date().toISOString(),
                appVersion: '1.0',
                statistics: stats,
                learningHistory: heuristicsEngine.learningHistory
            };

            // Descargar
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `learning_stats_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();

            console.log('[App] Learning stats exported as JSON');
            this.showNotification('📥 Estadísticas exportadas como JSON');
        } catch (error) {
            console.error('[App] Error exporting JSON:', error);
            this.showNotification('❌ Error al exportar');
        }
    }

    /**
     * NUEVO: Mostrar estadísticas de aprendizaje en consola
     */
    printLearningStats() {
        try {
            if (typeof heuristicsEngine === 'undefined') return;

            const stats = heuristicsEngine.getLearningStats();
            console.group('📊 ESTADÍSTICAS DE APRENDIZAJE');
            console.log('Total de eventos:', stats.totalEvents);
            console.log('Parámetros aprendidos:', stats.parametersLearned);
            console.log('Mejora promedio:', stats.averageImprovement.toFixed(4));
            console.log('Última actualización:', stats.lastUpdate);
            console.log('Confianza por parámetro:', stats.confidenceByParameter);
            console.log('Últimos eventos:', stats.recentEvents);
            console.groupEnd();
        } catch (error) {
            console.error('[App] Error printing stats:', error);
        }
    }
}

// Crear instancia global de la aplicación
const app = new RoadSignApp();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    await app.init();
});

// Manejar cambios de visibilidad de la página
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('[App] Page is hidden');
        cameraManager.pauseStream();
    } else {
        console.log('[App] Page is visible');
        if (cameraManager.isStreaming) {
            cameraManager.resumeStream();
        }
    }
});

// Manejar evento beforeunload
window.addEventListener('beforeunload', (event) => {
    if (window.currentSession && !window.currentSession.endTime) {
        event.returnValue = '¿Estás seguro? La sesión actual se perderá.';
        return event.returnValue;
    }
});

console.log('[App] Module loaded');
