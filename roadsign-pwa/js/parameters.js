/**
 * RoadSign Parameters Manager
 * Sistema modular y extensible de parámetros de evaluación
 */

class ParametersManager {
    constructor() {
        this.parameters = new Map();
        this.activeParameters = new Set();
        this.isInitialized = false;
        this.heuristics = {};
    }

    /**
     * Inicializar el gestor de parámetros
     */
    async init() {
        try {
            console.log('[Parameters] Initializing...');

            // Cargar parámetros predefinidos
            await this.loadPredefinedParameters();

            // Cargar parámetros guardados en BD
            const savedParams = await roadsignDB.getAllParameters();
            
            if (savedParams.length > 0) {
                // Si hay parámetros guardados, usarlos
                for (const param of savedParams) {
                    this.parameters.set(param.id, param);
                    if (param.active) {
                        this.activeParameters.add(param.id);
                    }
                }
            } else {
                // Si NO hay parámetros guardados, guardar los predefinidos ACTIVOS
                for (const [id, param] of this.parameters) {
                    // El parámetro base siempre activo
                    if (param.type === 'base') {
                        param.active = true;
                        this.activeParameters.add(id);
                    }
                    // Los plugins comienzan activos (excepto legibility_distance)
                    else if (param.type === 'plugin' && !param.id.includes('legibility_distance')) {
                        param.active = true;
                        this.activeParameters.add(id);
                    }
                    await roadsignDB.saveParameter(param);
                }
            }

            // GARANTIZAR que el parámetro base SIEMPRE está activo
            const baseParam = this.parameters.get('param_base');
            if (baseParam) {
                baseParam.active = true;
                baseParam.canDeactivate = false;
                this.activeParameters.add('param_base');
                await roadsignDB.saveParameter(baseParam);
            }

            this.isInitialized = true;
            console.log('[Parameters] Initialized with', this.parameters.size, 'parameters');
            
            return true;
        } catch (error) {
            console.error('[Parameters] Initialization error:', error);
            return false;
        }
    }

    /**
     * Cargar parámetros predefinidos
     */
    async loadPredefinedParameters() {
        // PARÁMETRO BASE (Obligatorio)
        this.parameters.set('param_base', {
            id: 'param_base',
            name: 'base',
            displayName: 'Estado de la Señal',
            type: 'base',
            active: true,
            version: '1.0',
            canDeactivate: false,
            
            definition: {
                description: 'Evaluación básica de legibilidad y daños',
                category: 'fundamental',
                priority: 'critical'
            },
            
            attributes: [
                {
                    id: 'legibility',
                    name: 'Legibilidad',
                    type: 'heuristic',
                    weight: 0.65
                },
                {
                    id: 'damage',
                    name: 'Daño',
                    type: 'heuristic',
                    weight: 0.35
                }
            ],
            
            damageTypes: [
                { value: 'fading', label: 'Decoloración', icon: '🖤' },
                { value: 'physical', label: 'Daño Físico', icon: '💔' },
                { value: 'reflectivity', label: 'Pérdida Reflectividad', icon: '👁️' },
                { value: 'dirt', label: 'Suciedad', icon: '🧹' }
            ],
            
            weatherConditions: [
                { value: 'sunny', label: 'Soleado', icon: '☀️' },
                { value: 'cloudy', label: 'Nublado', icon: '☁️' },
                { value: 'rainy', label: 'Lluvia', icon: '🌧️' },
                { value: 'night', label: 'Noche', icon: '🌙' }
            ],
            
            uiElements: {
                inputType: 'rating_selector',
                ratingScale: {
                    5: 'Excelente',
                    4: 'Bueno',
                    3: 'Regular',
                    2: 'Malo',
                    1: 'Pésimo'
                }
            },
            
            ratingImpact: {
                impactsRating: true,
                isBase: true
            },
            
            metadata: {
                author: 'system',
                createdDate: '2024-01-15',
                lastUpdated: '2024-01-15'
            }
        });

        // PARÁMETRO VANDALISMO
        this.parameters.set('param_vandalism', {
            id: 'param_vandalism',
            name: 'vandalism',
            displayName: 'Vandalismo',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Detecta y evalúa vandalismo (graffiti, pegatinas, etc.)',
                category: 'damage',
                priority: 'high'
            },
            
            attributes: [
                { id: 'presence', name: 'Presencia', type: 'boolean' },
                { id: 'types', name: 'Tipos', type: 'multiselect' },
                { id: 'coverage', name: 'Cobertura', type: 'percentage' },
                { id: 'severity', name: 'Severidad', type: 'select' }
            ],
            
            vandalismTypes: [
                { value: 'graffiti', label: 'Graffiti', icon: '🎨' },
                { value: 'stickers', label: 'Pegatinas', icon: '📌' },
                { value: 'scratches', label: 'Rasguños', icon: '✂️' },
                { value: 'other', label: 'Otro', icon: '❓' }
            ],
            
            severityLevels: [
                { value: 'none', label: 'Ninguno' },
                { value: 'low', label: 'Leve' },
                { value: 'medium', label: 'Medio' },
                { value: 'high', label: 'Alto' }
            ],
            
            uiElements: {
                inputType: 'conditional_form',
                structure: [
                    { type: 'yes_no', field: 'isVandalized', label: '¿Vandalizada?' },
                    {
                        type: 'multiselect',
                        field: 'types',
                        label: 'Tipos de vandalismo',
                        condition: 'isVandalized == true'
                    },
                    {
                        type: 'slider',
                        field: 'coverage',
                        label: 'Cobertura (%)',
                        min: 0,
                        max: 100,
                        condition: 'isVandalized == true'
                    },
                    {
                        type: 'select',
                        field: 'severity',
                        label: 'Severidad',
                        condition: 'isVandalized == true'
                    }
                ]
            },
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_coverage',
                maxImpact: -0.5
            },
            
            metadata: {
                author: 'system',
                createdDate: '2024-01-15'
            }
        });

        // PARÁMETRO ÁNGULO
        this.parameters.set('param_angle', {
            id: 'param_angle',
            name: 'angle',
            displayName: 'Ángulo de Visibilidad',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Evalúa si la señal está en ángulo óptimo',
                category: 'positioning',
                priority: 'medium'
            },
            
            attributes: [
                { id: 'detectedAngle', name: 'Ángulo Detectado', type: 'number' },
                { id: 'optimalAngle', name: 'Ángulo Óptimo', type: 'number' },
                { id: 'adequate', name: 'Adecuado', type: 'boolean' }
            ],
            
            optimalRanges: {
                vertical: { min: 70, max: 90, optimal: 85 },
                horizontal: { min: 80, max: 95, optimal: 90 }
            },
            
            uiElements: {
                inputType: 'auto_detect_confirm',
                showDetectedValue: true,
                userCanOverride: true,
                field: 'angleAdequate',
                label: '¿Ángulo adecuado?'
            },
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_deviation',
                maxImpact: -0.3
            },
            
            metadata: {
                author: 'system',
                createdDate: '2024-01-15'
            }
        });

        // PARÁMETRO DISTANCIA DE LEGIBILIDAD
        this.parameters.set('param_legibility_distance', {
            id: 'param_legibility_distance',
            name: 'legibilityDistance',
            displayName: 'Distancia de Legibilidad',
            type: 'plugin',
            active: false, // Desactivado por defecto
            version: '1.0',
            
            definition: {
                description: 'Evalúa si es legible desde la distancia requerida',
                category: 'readability',
                priority: 'medium'
            },
            
            attributes: [
                { id: 'estimatedDistance', name: 'Distancia Estimada', type: 'number' },
                { id: 'requiredDistance', name: 'Distancia Requerida', type: 'number' },
                { id: 'adequate', name: 'Adecuada', type: 'boolean' }
            ],
            
            requiredDistances: {
                highway: 60,
                urban: 45,
                parking: 20
            },
            
            uiElements: {
                inputType: 'auto_detect_confirm',
                showDetectedValue: true,
                unit: 'metros',
                field: 'distanceAdequate',
                label: '¿Distancia adecuada?'
            },
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_adequacy',
                maxImpact: -0.25
            },
            
            metadata: {
                author: 'system',
                createdDate: '2024-01-15'
            }
        });

        // PARÁMETRO MANTENIMIENTO
        this.parameters.set('param_maintenance', {
            id: 'param_maintenance',
            name: 'maintenance',
            displayName: 'Mantenimiento Requerido',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Evalúa necesidad y urgencia de mantenimiento',
                category: 'maintenance',
                priority: 'high'
            },
            
            attributes: [
                { id: 'required', name: 'Requerido', type: 'boolean' },
                { id: 'urgency', name: 'Urgencia', type: 'select' },
                { id: 'actions', name: 'Acciones', type: 'multiselect' },
                { id: 'estimatedCost', name: 'Costo Estimado', type: 'select' }
            ],
            
            urgencyLevels: [
                { value: 'low', label: 'Baja', color: '#4CAF50' },
                { value: 'medium', label: 'Media', color: '#FF9800' },
                { value: 'high', label: 'Alta', color: '#F44336' }
            ],
            
            maintenanceActions: [
                { value: 'cleaning', label: 'Limpieza', cost: 'low' },
                { value: 'paint_refresh', label: 'Repintado', cost: 'medium' },
                { value: 'structural_repair', label: 'Reparación Estructural', cost: 'high' },
                { value: 'reflective_coating', label: 'Recubrimiento Reflectivo', cost: 'medium' },
                { value: 'replacement', label: 'Reemplazo', cost: 'high' }
            ],
            
            costLevels: [
                { value: 'low', label: 'Bajo', range: '0-500€' },
                { value: 'medium', label: 'Medio', range: '500-2000€' },
                { value: 'high', label: 'Alto', range: '+2000€' }
            ],
            
            uiElements: {
                inputType: 'conditional_form',
                structure: [
                    { type: 'yes_no', field: 'maintenanceRequired', label: '¿Requiere mantenimiento?' },
                    {
                        type: 'select',
                        field: 'urgency',
                        label: 'Urgencia',
                        condition: 'maintenanceRequired == true'
                    },
                    {
                        type: 'multiselect',
                        field: 'actions',
                        label: 'Acciones recomendadas',
                        condition: 'maintenanceRequired == true'
                    }
                ]
            },
            
            ratingImpact: {
                impactsRating: false, // No afecta rating, es informativo
                isInformational: true
            },
            
            metadata: {
                author: 'system',
                createdDate: '2024-01-15'
            }
        });

        // PARÁMETRO ILUMINACIÓN NOCTURNA
        this.parameters.set('param_night_lighting', {
            id: 'param_night_lighting',
            name: 'nightLighting',
            displayName: 'Iluminación Nocturna',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Evalúa visibilidad y brillo en condiciones nocturnas',
                category: 'safety',
                priority: 'high'
            },
            
            attributes: [
                { id: 'nightVisibility', name: 'Visibilidad Nocturna', type: 'rating' },
                { id: 'ledFunctional', name: 'LED/Iluminación Funcional', type: 'boolean' },
                { id: 'brightness', name: 'Nivel de Brillo', type: 'number' }
            ],
            
            ratingImpact: {
                impactsRating: true,
                formula: 'multiply_by_night_factor',
                maxImpact: -0.20
            },
            
            metadata: {
                author: 'system',
                createdDate: '2025-05-31',
                category: 'visibility'
            }
        });

        // PARÁMETRO OXIDACIÓN/CORROSIÓN
        this.parameters.set('param_oxidation', {
            id: 'param_oxidation',
            name: 'oxidation',
            displayName: 'Oxidación/Corrosión',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Detecta y evalúa óxido, corrosión y desgaste metálico',
                category: 'durability',
                priority: 'medium'
            },
            
            attributes: [
                { id: 'oxidationLevel', name: 'Nivel de Oxidación', type: 'rating' },
                { id: 'hasRust', name: 'Tiene Óxido', type: 'boolean' },
                { id: 'affectedArea', name: 'Área Afectada (%)', type: 'number' }
            ],
            
            oxidationLevels: [
                { value: 'none', label: 'Sin oxidación', icon: '✨' },
                { value: 'minor', label: 'Menor', icon: '⚠️' },
                { value: 'moderate', label: 'Moderado', icon: '🔶' },
                { value: 'severe', label: 'Severo', icon: '🔴' }
            ],
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_corrosion',
                maxImpact: -0.28
            },
            
            metadata: {
                author: 'system',
                createdDate: '2025-05-31',
                category: 'structural'
            }
        });

        // PARÁMETRO REFLECTIVIDAD
        this.parameters.set('param_reflectivity', {
            id: 'param_reflectivity',
            name: 'reflectivity',
            displayName: 'Reflectividad',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Evalúa capacidad reflectante en lluvia y condiciones húmedas',
                category: 'visibility',
                priority: 'high'
            },
            
            attributes: [
                { id: 'reflectiveLevel', name: 'Nivel Reflectante', type: 'rating' },
                { id: 'rainReflection', name: 'Reflejo en Lluvia', type: 'boolean' },
                { id: 'reflectiveCoating', name: 'Recubrimiento Reflectante', type: 'boolean' }
            ],
            
            reflectivityLevels: [
                { value: 'excellent', label: 'Excelente', icon: '💎' },
                { value: 'good', label: 'Bueno', icon: '✅' },
                { value: 'fair', label: 'Aceptable', icon: '⚠️' },
                { value: 'poor', label: 'Pobre', icon: '❌' }
            ],
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_reflectivity',
                maxImpact: -0.22
            },
            
            metadata: {
                author: 'system',
                createdDate: '2025-05-31',
                category: 'visibility'
            }
        });

        // PARÁMETRO LIMPIEZA DE CRISTAL
        this.parameters.set('param_glass_cleanliness', {
            id: 'param_glass_cleanliness',
            name: 'glassCleanliness',
            displayName: 'Limpieza de Cristal',
            type: 'plugin',
            active: true,
            version: '1.0',
            
            definition: {
                description: 'Evalúa estado de limpieza del cristal o plexiglass',
                category: 'maintenance',
                priority: 'medium'
            },
            
            attributes: [
                { id: 'cleanliness', name: 'Nivel de Limpieza', type: 'rating' },
                { id: 'hasDirt', name: 'Tiene Suciedad', type: 'boolean' },
                { id: 'visibility', name: 'Visibilidad %', type: 'number' }
            ],
            
            cleanlinesLevels: [
                { value: 'clean', label: 'Limpio', icon: '✨' },
                { value: 'minor_dirt', label: 'Algo Sucio', icon: '💧' },
                { value: 'dirty', label: 'Sucio', icon: '🧹' },
                { value: 'very_dirty', label: 'Muy Sucio', icon: '⚠️' }
            ],
            
            ratingImpact: {
                impactsRating: true,
                formula: 'reduce_by_dirt',
                maxImpact: -0.15
            },
            
            metadata: {
                author: 'system',
                createdDate: '2025-05-31',
                category: 'cleanliness'
            }
        });

        console.log('[Parameters] Loaded', this.parameters.size, 'predefined parameters');
    }

    /**
     * Obtener parámetro por ID
     */
    getParameter(parameterId) {
        return this.parameters.get(parameterId);
    }

    /**
     * Obtener todos los parámetros
     */
    getAllParameters() {
        return Array.from(this.parameters.values());
    }

    /**
     * Obtener parámetros activos
     */
    getActiveParameters() {
        return Array.from(this.activeParameters).map((id) => this.parameters.get(id));
    }

    /**
     * Activar parámetro
     */
    async activateParameter(parameterId) {
        const param = this.parameters.get(parameterId);
        if (!param || param.type === 'base') {
            return false;
        }

        this.activeParameters.add(parameterId);
        param.active = true;
        
        await roadsignDB.saveParameter(param);
        console.log('[Parameters] Activated:', parameterId);
        
        return true;
    }

    /**
     * Desactivar parámetro
     */
    async deactivateParameter(parameterId) {
        const param = this.parameters.get(parameterId);
        // NO permitir desactivar parámetro base ni parámetros con canDeactivate: false
        if (!param || param.canDeactivate === false || param.type === 'base' || param.id === 'param_base') {
            console.log('[Parameters] Cannot deactivate:', parameterId, '(protected)');
            return false;
        }

        this.activeParameters.delete(parameterId);
        param.active = false;
        
        await roadsignDB.saveParameter(param);
        console.log('[Parameters] Deactivated:', parameterId);
        
        return true;
    }

    /**
     * Agregar parámetro personalizado
     */
    async addCustomParameter(parameterDef) {
        if (!parameterDef.id || !parameterDef.name) {
            throw new Error('Parameter must have id and name');
        }

        parameterDef.type = 'plugin';
        parameterDef.metadata = parameterDef.metadata || {};
        parameterDef.metadata.createdDate = new Date().toISOString();

        this.parameters.set(parameterDef.id, parameterDef);
        
        if (parameterDef.active) {
            this.activeParameters.add(parameterDef.id);
        }

        await roadsignDB.saveParameter(parameterDef);
        console.log('[Parameters] Added custom parameter:', parameterDef.id);
        
        return parameterDef;
    }

    /**
     * Eliminar parámetro personalizado
     */
    async removeCustomParameter(parameterId) {
        const param = this.parameters.get(parameterId);
        
        if (!param || param.type !== 'plugin') {
            return false;
        }

        this.parameters.delete(parameterId);
        this.activeParameters.delete(parameterId);

        // Eliminar de BD
        // TODO: Implementar delete en roadsignDB

        console.log('[Parameters] Removed custom parameter:', parameterId);
        return true;
    }

    /**
     * Obtener definición de formulario para parámetro
     */
    getFormDefinition(parameterId) {
        const param = this.parameters.get(parameterId);
        if (!param) return null;

        return {
            parameterId: param.id,
            displayName: param.displayName,
            description: param.definition?.description,
            uiElements: param.uiElements,
            attributes: param.attributes,
            options: {
                damageTypes: param.damageTypes,
                weatherConditions: param.weatherConditions,
                vandalismTypes: param.vandalismTypes,
                severityLevels: param.severityLevels,
                urgencyLevels: param.urgencyLevels,
                maintenanceActions: param.maintenanceActions
            }
        };
    }

    /**
     * Generar HTML de formulario para parámetro
     */
    generateParameterFormHTML(parameterId) {
        const param = this.parameters.get(parameterId);
        if (!param) return '';

        let html = `<div class="parameter-section" id="param-${param.id}">`;
        html += `<h3>${param.displayName}</h3>`;

        const formDef = this.getFormDefinition(parameterId);

        if (param.id === 'param_base') {
            // BASE: Rating selector
            html += this.generateRatingSelector();
            html += this.generateDamageCheckboxes();
            html += this.generateWeatherRadios();
        } else if (param.id === 'param_vandalism') {
            html += this.generateVandalismForm();
        } else if (param.id === 'param_angle') {
            html += this.generateAngleForm();
        } else if (param.id === 'param_maintenance') {
            html += this.generateMaintenanceForm();
        } else if (param.id === 'param_legibility_distance') {
            html += this.generateLegibilityDistanceForm();
        }

        html += '</div>';
        return html;
    }

    /**
     * Generar selector de rating
     */
    generateRatingSelector() {
        return `
            <div class="rating-selector">
                <label><input type="radio" name="rating" value="5"> ⭐ Excelente (5)</label>
                <label><input type="radio" name="rating" value="4"> ⭐ Bueno (4)</label>
                <label><input type="radio" name="rating" value="3"> ⭐ Regular (3)</label>
                <label><input type="radio" name="rating" value="2"> ⭐ Malo (2)</label>
                <label><input type="radio" name="rating" value="1"> ⭐ Pésimo (1)</label>
            </div>
        `;
    }

    /**
     * Generar checkboxes de daño
     */
    generateDamageCheckboxes() {
        const param = this.parameters.get('param_base');
        let html = '<div class="checkbox-group"><h4>Tipos de Daño:</h4>';
        
        param.damageTypes.forEach((damage) => {
            html += `<label><input type="checkbox" name="damage" value="${damage.value}"> ${damage.label}</label>`;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Generar radios de clima
     */
    generateWeatherRadios() {
        const param = this.parameters.get('param_base');
        let html = '<div class="radio-group"><h4>Condiciones Climáticas:</h4>';
        
        param.weatherConditions.forEach((weather) => {
            html += `<label><input type="radio" name="weather" value="${weather.value}"> ${weather.icon} ${weather.label}</label>`;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Generar formulario de vandalismo
     */
    generateVandalismForm() {
        const param = this.parameters.get('param_vandalism');
        let html = `<div class="vandalism-form">`;
        html += `<label>¿Vandalizada? <input type="checkbox" name="isVandalized"></label>`;
        html += `<div class="vandalism-options hidden">`;
        html += `<h4>Tipos de vandalismo:</h4>`;
        
        param.vandalismTypes.forEach((type) => {
            html += `<label><input type="checkbox" name="vandalismType" value="${type.value}"> ${type.label}</label>`;
        });
        
        html += `<h4>Severidad:</h4>`;
        param.severityLevels.forEach((level) => {
            html += `<label><input type="radio" name="vandalismSeverity" value="${level.value}"> ${level.label}</label>`;
        });
        
        html += `</div></div>`;
        return html;
    }

    /**
     * Generar formulario de ángulo
     */
    generateAngleForm() {
        return `
            <div class="angle-form">
                <p>Ángulo detectado: <strong id="detectedAngle">-</strong>°</p>
                <p>Ángulo óptimo: <strong>85°</strong></p>
                <label><input type="radio" name="angleAdequate" value="yes"> ✓ Adecuado</label>
                <label><input type="radio" name="angleAdequate" value="no"> ✗ No adecuado</label>
            </div>
        `;
    }

    /**
     * Generar formulario de mantenimiento
     */
    generateMaintenanceForm() {
        const param = this.parameters.get('param_maintenance');
        let html = `<div class="maintenance-form">`;
        html += `<label>¿Requiere mantenimiento? <input type="checkbox" name="maintenanceRequired"></label>`;
        html += `<div class="maintenance-options hidden">`;
        html += `<h4>Urgencia:</h4>`;
        
        param.urgencyLevels.forEach((level) => {
            html += `<label><input type="radio" name="urgency" value="${level.value}"> ${level.label}</label>`;
        });
        
        html += `<h4>Acciones recomendadas:</h4>`;
        param.maintenanceActions.forEach((action) => {
            html += `<label><input type="checkbox" name="action" value="${action.value}"> ${action.label}</label>`;
        });
        
        html += `</div></div>`;
        return html;
    }

    /**
     * Generar formulario de distancia de legibilidad
     */
    generateLegibilityDistanceForm() {
        return `
            <div class="legibility-distance-form">
                <p>Distancia legible estimada: <strong id="estimatedDistance">-</strong> m</p>
                <p>Distancia requerida: <strong>50</strong> m</p>
                <label><input type="radio" name="distanceAdequate" value="yes"> ✓ Adecuada</label>
                <label><input type="radio" name="distanceAdequate" value="no"> ✗ No adecuada</label>
            </div>
        `;
    }

    /**
     * Obtener estado del parámetro
     */
    getParameterStatus(parameterId) {
        const param = this.parameters.get(parameterId);
        if (!param) return null;

        return {
            id: param.id,
            name: param.name,
            displayName: param.displayName,
            active: this.activeParameters.has(parameterId),
            type: param.type,
            canDeactivate: param.canDeactivate !== false,
            version: param.version
        };
    }

    /**
     * Obtener todos los estados
     */
    getAllParameterStatuses() {
        return this.getAllParameters().map((param) => this.getParameterStatus(param.id));
    }
}

// Crear instancia global del gestor de parámetros
const parametersManager = new ParametersManager();

console.log('[Parameters] Module loaded');
