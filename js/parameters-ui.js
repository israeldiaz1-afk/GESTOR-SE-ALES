/**
 * RoadSign Parameters UI Manager
 * Gestiona la generación e interacción de formularios de parámetros
 */

class ParametersUIManager {
    constructor() {
        this.activeParameterForms = new Map();
    }

    /**
     * Inicializar gestor de UI
     */
    async init() {
        console.log('[ParametersUI] Initializing...');

        // Esperar a que parámetros estén listos
        if (!parametersManager.isInitialized) {
            await parametersManager.init();
        }

        // Generar UI inicial
        this.refreshParameterForms();

        console.log('[ParametersUI] Initialized');
    }

    /**
     * Refrescar todos los formularios de parámetros
     */
    refreshParameterForms() {
        const container = document.getElementById('dynamic-modules-container');
        if (!container) return;

        container.innerHTML = '';
        const activeParams = parametersManager.getActiveParameters();

        for (const param of activeParams) {
            if (param.id === 'param_base') continue; // BASE ya está en la UI

            const formHTML = parametersManager.generateParameterFormHTML(param.id);
            container.innerHTML += formHTML;

            // Adjuntar listeners
            this.attachParameterListeners(param.id);
        }

        console.log('[ParametersUI] Refreshed', activeParams.length, 'parameter forms');
    }

    /**
     * Adjuntar listeners a formularios de parámetros
     */
    attachParameterListeners(parameterId) {
        const param = parametersManager.getParameter(parameterId);
        if (!param) return;

        if (parameterId === 'param_vandalism') {
            this.attachVandalismListeners();
        } else if (parameterId === 'param_maintenance') {
            this.attachMaintenanceListeners();
        } else if (parameterId === 'param_angle') {
            this.attachAngleListeners();
        }
    }

    /**
     * Adjuntar listeners a formulario de vandalismo
     */
    attachVandalismListeners() {
        const checkbox = document.querySelector('input[name="isVandalized"]');
        const options = document.querySelector('.vandalism-options');

        if (checkbox && options) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    options.classList.remove('hidden');
                } else {
                    options.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Adjuntar listeners a formulario de mantenimiento
     */
    attachMaintenanceListeners() {
        const checkbox = document.querySelector('input[name="maintenanceRequired"]');
        const options = document.querySelector('.maintenance-options');

        if (checkbox && options) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    options.classList.remove('hidden');
                } else {
                    options.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Adjuntar listeners a formulario de ángulo
     */
    attachAngleListeners() {
        // Ángulo se detecta automáticamente, usuario confirma
        const adequateRadios = document.querySelectorAll('input[name="angleAdequate"]');
        adequateRadios.forEach((radio) => {
            radio.addEventListener('change', (e) => {
                console.log('[ParametersUI] Angle adequacy changed:', e.target.value);
            });
        });
    }

    /**
     * Recolectar datos del formulario de parámetros
     */
    collectParameterData() {
        const data = {
            activeModules: ['base'], // BASE siempre activo
            base: {
                damageType: [],
                weatherCondition: 'sunny',
                visibility: 'clear'
            },
            vandalism: null,
            angle: null,
            maintenance: null,
            legibilityDistance: null
        };

        // Recolectar datos de BASE
        const damageCheckboxes = document.querySelectorAll('input[name="damage"]:checked');
        data.base.damageType = Array.from(damageCheckboxes).map((el) => el.value);

        const weatherRadio = document.querySelector('input[name="weather"]:checked');
        if (weatherRadio) {
            data.base.weatherCondition = weatherRadio.value;
        }

        // Recolectar datos de VANDALISMO
        if (parametersManager.activeParameters.has('param_vandalism')) {
            data.activeModules.push('vandalism');

            const isVandalizedCheckbox = document.querySelector('input[name="isVandalized"]');
            const vandalismTypes = Array.from(
                document.querySelectorAll('input[name="vandalismType"]:checked')
            ).map((el) => el.value);
            const severityRadio = document.querySelector('input[name="vandalismSeverity"]:checked');

            if (isVandalizedCheckbox) {
                data.vandalism = {
                    isVandalized: isVandalizedCheckbox.checked,
                    types: vandalismTypes,
                    severity: severityRadio?.value || 'none'
                };
            }
        }

        // Recolectar datos de ÁNGULO
        if (parametersManager.activeParameters.has('param_angle')) {
            data.activeModules.push('angle');

            const angleAdequateRadio = document.querySelector('input[name="angleAdequate"]:checked');
            data.angle = {
                adequate: angleAdequateRadio?.value === 'yes'
            };
        }

        // Recolectar datos de MANTENIMIENTO
        if (parametersManager.activeParameters.has('param_maintenance')) {
            data.activeModules.push('maintenance');

            const maintenanceCheckbox = document.querySelector('input[name="maintenanceRequired"]');
            const urgencyRadio = document.querySelector('input[name="urgency"]:checked');
            const actions = Array.from(
                document.querySelectorAll('input[name="action"]:checked')
            ).map((el) => el.value);

            if (maintenanceCheckbox) {
                data.maintenance = {
                    required: maintenanceCheckbox.checked,
                    urgency: urgencyRadio?.value || 'low',
                    actions: actions
                };
            }
        }

        // Recolectar datos de DISTANCIA DE LEGIBILIDAD
        if (parametersManager.activeParameters.has('param_legibility_distance')) {
            data.activeModules.push('legibilityDistance');

            const distanceAdequateRadio = document.querySelector('input[name="distanceAdequate"]:checked');
            data.legibilityDistance = {
                adequate: distanceAdequateRadio?.value === 'yes'
            };
        }

        console.log('[ParametersUI] Collected parameter data:', data);
        return data;
    }

    /**
     * Generar resumen de impacto de parámetros
     */
    generateImpactSummary(baseRating, parameterImpacts) {
        const container = document.getElementById('impact-modules-container');
        if (!container) return;

        container.innerHTML = '';
        let totalImpact = 0;

        for (const impact of parameterImpacts) {
            if (impact && impact.ratingImpact !== undefined && impact.ratingImpact !== 0) {
                const impactStr = impact.ratingImpact > 0 ? '+' : '';
                const paramName = this.getParameterName(impact.parameterId);

                container.innerHTML += `
                    <div class="impact-row">
                        <span>${paramName}:</span>
                        <span>${impactStr}${impact.ratingImpact.toFixed(2)}</span>
                    </div>
                `;

                totalImpact += impact.ratingImpact;
            }
        }

        // Mostrar total
        if (totalImpact !== 0) {
            container.innerHTML += `
                <div class="impact-row final">
                    <span>Total de Impactos:</span>
                    <span>${totalImpact > 0 ? '+' : ''}${totalImpact.toFixed(2)}</span>
                </div>
            `;
        }

        // Actualizar rating final
        const finalRating = Math.max(1, Math.min(5, baseRating + totalImpact));
        const finalElement = document.getElementById('impact-final');
        if (finalElement) {
            finalElement.textContent = finalRating.toFixed(1);
        }
    }

    /**
     * Obtener nombre de parámetro
     */
    getParameterName(parameterId) {
        const param = parametersManager.getParameter(parameterId);
        return param ? param.displayName : parameterId;
    }

    /**
     * Pantalla de configuración de parámetros
     */
    generateSettingsScreen() {
        const allParams = parametersManager.getAllParameterStatuses();
        let html = '<div class="parameters-settings">';

        html += '<h2>⚙️ Parámetros y Módulos</h2>';

        for (const param of allParams) {
            const toggleDisabled = param.type === 'base';
            const statusText = param.active ? '✅ Activo' : '⭐ Inactivo';
            const toggleClass = toggleDisabled ? 'disabled' : '';

            html += `
                <div class="parameter-setting">
                    <div class="param-info">
                        <h3>${param.displayName}</h3>
                        <p class="param-type">${param.type === 'base' ? 'Módulo Base (Obligatorio)' : 'Plugin Opcional'}</p>
                        <p class="param-status ${param.active ? 'active' : 'inactive'}">${statusText}</p>
                    </div>
                    <div class="param-control">
                        <input 
                            type="checkbox" 
                            class="param-toggle ${toggleClass}"
                            data-param-id="${param.id}"
                            ${param.active ? 'checked' : ''}
                            ${toggleDisabled ? 'disabled' : ''}
                        />
                    </div>
                </div>
            `;
        }

        html += '</div>';

        // Agregar listeners
        setTimeout(() => {
            this.attachSettingsListeners();
        }, 100);

        return html;
    }

    /**
     * Adjuntar listeners a configuración
     */
    attachSettingsListeners() {
        const toggles = document.querySelectorAll('.param-toggle:not(.disabled)');

        toggles.forEach((toggle) => {
            toggle.addEventListener('change', async (e) => {
                const paramId = toggle.getAttribute('data-param-id');

                if (e.target.checked) {
                    await parametersManager.activateParameter(paramId);
                } else {
                    await parametersManager.deactivateParameter(paramId);
                }

                // Refrescar formularios
                this.refreshParameterForms();

                // Mostrar confirmación
                const message = e.target.checked ? 
                    `✅ Módulo activado` : 
                    `⭐ Módulo desactivado`;
                
                console.log('[ParametersUI]', message, paramId);
            });
        });
    }
}

// Crear instancia global del gestor de UI de parámetros
const parametersUIManager = new ParametersUIManager();

console.log('[ParametersUI] Module loaded');
