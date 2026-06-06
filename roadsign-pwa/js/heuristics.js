/**
 * RoadSign Heuristics Engine
 * Sistema de heurísticas para evaluación automática de señales
 */

class HeuristicsEngine {
    constructor() {
        this.baseHeuristics = {
            legibility: 0.65,  // Peso de legibilidad
            damage: 0.35       // Peso de daño
        };
        this.learningWeights = {};
        this.learningHistory = [];  // NUEVO: Histórico de cambios
        this.parameterConfidence = {};  // NUEVO: Confianza por parámetro
        this.isInitialized = false;
    }

    /**
     * Inicializar engine de heurísticas
     */
    async init() {
        try {
            console.log('[Heuristics] Initializing...');

            // Cargar pesos aprendidos desde BD
            const savedWeights = await roadsignDB.getAllWeights();
            
            for (const weight of savedWeights) {
                this.learningWeights[weight.parameterId] = weight.weight;
                // NUEVO: Inicializar confianza basada en histórico
                this.parameterConfidence[weight.parameterId] = weight.confidence || 0.5;
            }

            this.isInitialized = true;
            console.log('[Heuristics] Initialized with', Object.keys(this.learningWeights).length, 'learned weights');
            
            return true;
        } catch (error) {
            console.error('[Heuristics] Initialization error:', error);
            return false;
        }
    }

    /**
     * NUEVO: Registrar evento de aprendizaje
     */
    recordLearningEvent(parameterId, oldWeight, newWeight, reason = 'auto') {
        const event = {
            timestamp: new Date().toISOString(),
            parameterId: parameterId,
            oldWeight: oldWeight,
            newWeight: newWeight,
            change: newWeight - oldWeight,
            reason: reason,
            improvement: Math.abs(newWeight - oldWeight) > 0.01
        };
        
        this.learningHistory.push(event);
        console.log('[Heuristics] Learning event:', event);
        
        return event;
    }

    /**
     * NUEVO: Obtener estadísticas de aprendizaje
     */
    getLearningStats() {
        const stats = {
            totalEvents: this.learningHistory.length,
            averageImprovement: 0,
            parametersLearned: Object.keys(this.learningWeights).length,
            lastUpdate: this.learningHistory.length > 0 ? this.learningHistory[this.learningHistory.length - 1].timestamp : null,
            confidenceByParameter: this.parameterConfidence,
            recentEvents: this.learningHistory.slice(-10)  // Últimos 10 eventos
        };

        if (this.learningHistory.length > 0) {
            const improvements = this.learningHistory.map(e => Math.abs(e.change));
            stats.averageImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
        }

        return stats;
    }

    /**
     * NUEVO: Obtener histórico formateado para exportación
     */
    getFormattedHistory() {
        return this.learningHistory.map(event => ({
            'Fecha/Hora': new Date(event.timestamp).toLocaleString(),
            'Parámetro': event.parameterId,
            'Peso Anterior': event.oldWeight.toFixed(4),
            'Peso Nuevo': event.newWeight.toFixed(4),
            'Cambio': event.change.toFixed(4),
            'Razón': event.reason,
            'Mejora': event.improvement ? 'Sí' : 'No'
        }));
    }

    /**
     * NUEVO: Actualizar confianza de parámetro
     */
    updateParameterConfidence(parameterId, newConfidence) {
        this.parameterConfidence[parameterId] = Math.min(1, Math.max(0, newConfidence));
    }

    /**
     * NUEVO: Resetear histórico
     */
    resetHistory() {
        this.learningHistory = [];
        this.learningWeights = {};
        this.parameterConfidence = {};
        console.log('[Heuristics] History reset');
    }

    /**
     * Evaluar módulo BASE (Legibilidad + Daño)
     */
    evaluateBase(imageData, signalType = 'vertical') {
        try {
            const legibilityScore = this.analyzeLegibility(imageData);
            const damages = this.analyzeDamages(imageData);
            
            // Calcular peso máximo de daños
            const damageWeights = Object.values(damages);
            const maxDamageWeight = Math.max(...damageWeights);
            
            // Obtener pesos (aprendidos o por defecto)
            const legibilityWeight = this.learningWeights['base_legibility'] || this.baseHeuristics.legibility;
            const damageWeight = this.learningWeights['base_damage'] || this.baseHeuristics.damage;
            
            // Fórmula final
            const finalScore = (legibilityScore * legibilityWeight) + 
                              ((1 - maxDamageWeight) * damageWeight);
            
            // Convertir a escala 1-5
            const rating = Math.max(1, Math.min(5, Math.round(finalScore * 4) + 1));
            
            // Calcular confianza
            const confidence = (legibilityScore + (1 - maxDamageWeight)) / 2;
            
            return {
                rating: rating,
                confidence: Math.min(confidence, 0.95),
                breakdown: {
                    legibility: legibilityScore,
                    damages: damages,
                    maxDamageWeight: maxDamageWeight,
                    finalScore: finalScore
                }
            };
        } catch (error) {
            console.error('[Heuristics] Error evaluating base:', error);
            return {
                rating: 3,
                confidence: 0.0,
                breakdown: { error: error.message }
            };
        }
    }

    /**
     * Analizar legibilidad de imagen
     */
    analyzeLegibility(imageData) {
        // Convertir data URI a canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        return new Promise((resolve) => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Calcular contraste y brillo
                let brightness = 0;
                let contrast = 0;
                let pixelCount = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Brillo promedio
                    const gray = (r + g + b) / 3;
                    brightness += gray / 255;
                    
                    pixelCount++;
                }

                brightness = brightness / pixelCount;

                // Calcular contraste (desviación estándar simplificada)
                let deviationSum = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const gray = (r + g + b) / 3 / 255;
                    
                    deviationSum += Math.pow(gray - brightness, 2);
                }

                contrast = Math.sqrt(deviationSum / pixelCount);

                // Legibilidad = f(brightness, contrast)
                // Ideal: brightness ~ 0.5, contrast > 0.2
                let legibilityScore = 0;

                // Factor de brillo (0.3-0.7 es ideal)
                const brightnessScore = 1 - Math.abs(brightness - 0.5) * 2;
                
                // Factor de contraste (más es mejor, hasta cierto punto)
                const contrastScore = Math.min(contrast * 2, 1);

                // Combinación ponderada
                legibilityScore = (brightnessScore * 0.4) + (contrastScore * 0.6);
                legibilityScore = Math.max(0, Math.min(1, legibilityScore));

                console.log('[Heuristics] Legibility analysis:', {
                    brightness: brightness.toFixed(2),
                    contrast: contrast.toFixed(3),
                    brightnessScore: brightnessScore.toFixed(2),
                    contrastScore: contrastScore.toFixed(2),
                    legibilityScore: legibilityScore.toFixed(2)
                });

                resolve(legibilityScore);
            };

            img.src = imageData;
        });
    }

    /**
     * Analizar daños en imagen
     */
    analyzeDamages(imageData) {
        // Análisis simplificado basado en cambios de color y textura
        // En producción, usar modelo entrenado o análisis más sofisticado

        const damages = {
            fading: 0,          // Decoloración (desaturación)
            physical: 0,        // Daño físico (bordes irregulares)
            reflectivity: 0,    // Pérdida reflectividad (brillo)
            dirt: 0             // Suciedad (áreas obscuras)
        };

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        return new Promise((resolve) => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                let fadingPixels = 0;
                let dirtyPixels = 0;
                let lowBrightnessPixels = 0;

                // Analizar píxeles
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Decoloración: baja saturación
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const saturation = max === 0 ? 0 : (max - min) / max;

                    if (saturation < 0.3) {
                        fadingPixels++;
                    }

                    // Suciedad: píxeles oscuros
                    const brightness = (r + g + b) / 3;
                    if (brightness < 80) {
                        dirtyPixels++;
                        lowBrightnessPixels++;
                    }
                }

                // Calcular proporciones
                const totalPixels = data.length / 4;
                damages.fading = fadingPixels / totalPixels;
                damages.dirt = dirtyPixels / totalPixels;
                damages.reflectivity = lowBrightnessPixels / totalPixels;

                // Daño físico: por ahora 0 (requiere análisis más sofisticado)
                damages.physical = 0;

                // Limitar valores a 0-1
                Object.keys(damages).forEach((key) => {
                    damages[key] = Math.max(0, Math.min(1, damages[key]));
                });

                console.log('[Heuristics] Damage analysis:', damages);

                resolve(damages);
            };

            img.src = imageData;
        });
    }

    /**
     * Evaluar parámetro de Vandalismo
     */
    evaluateVandalism(isVandalized, types = [], coverage = 0, severity = 'none') {
        const impact = {
            isVandalized: isVandalized,
            types: types,
            coverage: coverage,
            severity: severity,
            ratingImpact: 0
        };

        if (isVandalized) {
            // Impacto basado en cobertura
            // 10% cobertura = -0.1 en rating
            impact.ratingImpact = -(coverage / 100) * 0.5; // Máximo -0.5
        }

        return impact;
    }

    /**
     * Evaluar parámetro de Ángulo
     */
    evaluateAngle(detectedAngle, signalType = 'vertical') {
        const optimalRanges = {
            vertical: { min: 70, max: 90, optimal: 85 },
            horizontal: { min: 80, max: 95, optimal: 90 }
        };

        const range = optimalRanges[signalType] || optimalRanges.vertical;
        
        // Calcular desviación del ángulo óptimo
        let deviation = Math.abs(detectedAngle - range.optimal);
        let angleScore = 1 - (deviation / 50); // -50° = score 0
        angleScore = Math.max(0, Math.min(1, angleScore));

        const impact = {
            optimalAngle: range.optimal,
            detectedAngle: detectedAngle,
            angleAdequate: angleScore > 0.7,
            angleScore: angleScore,
            ratingImpact: -(1 - angleScore) * 0.3 // Máximo -0.3
        };

        return impact;
    }

    /**
     * Evaluar parámetro de Distancia de Legibilidad
     */
    evaluateLegibilityDistance(estimatedDistance, requiredDistance) {
        let adequacyScore = estimatedDistance / requiredDistance;
        adequacyScore = Math.min(1, adequacyScore);

        const impact = {
            estimatedDistance: estimatedDistance,
            requiredDistance: requiredDistance,
            adequate: estimatedDistance >= (requiredDistance * 0.9),
            adequacyScore: adequacyScore,
            ratingImpact: -(1 - adequacyScore) * 0.25 // Máximo -0.25
        };

        return impact;
    }

    /**
     * Calcular rating final con múltiples parámetros
     */
    calculateFinalRating(baseRating, parameterImpacts = []) {
        let finalRating = baseRating;
        let totalImpact = 0;

        // Aplicar impacto de cada parámetro
        for (const param of parameterImpacts) {
            if (param && param.ratingImpact !== undefined) {
                totalImpact += param.ratingImpact;
            }
        }

        finalRating = finalRating + totalImpact;

        // Limitar a rango 1-5
        finalRating = Math.max(1, Math.min(5, finalRating));

        return {
            finalRating: Math.round(finalRating * 10) / 10, // Redondear a 1 decimal
            baseRating: baseRating,
            totalImpact: totalImpact,
            impacts: parameterImpacts
        };
    }

    /**
     * Registrar feedback de evaluación para aprendizaje
     */
    async recordFeedback(parameterId, aiSuggestedRating, userConfirmedRating, confidence) {
        try {
            const error = userConfirmedRating - aiSuggestedRating;
            const learningRate = 0.02; // Qué tan rápido aprende

            // Obtener peso actual
            let currentWeight = this.learningWeights[parameterId] || 
                               this.baseHeuristics[parameterId] || 0.5;

            if (error === 0) {
                // ✓ Acertado: aumentar confianza
                currentWeight += learningRate * 0.1;
            } else if (error > 0) {
                // ✗ Subestimaré: disminuir peso
                currentWeight -= learningRate * Math.abs(error);
            } else {
                // ✗ Sobrestiméé: aumentar peso con cuidado
                currentWeight += learningRate * Math.abs(error) * 0.5;
            }

            // Limitar a rango 0-1
            currentWeight = Math.max(0, Math.min(1, currentWeight));

            // Guardar en memoria
            this.learningWeights[parameterId] = currentWeight;

            // Guardar en BD
            const weight = {
                parameterId: parameterId,
                weight: currentWeight,
                originalWeight: this.baseHeuristics[parameterId] || 0.5,
                adjustment: currentWeight - (this.baseHeuristics[parameterId] || 0.5),
                feedbackCount: 1,
                accuracy: Math.max(0, 1 - Math.abs(error) / 5), // Precisión 0-1
                lastUpdate: Date.now()
            };

            await roadsignDB.saveWeight(weight);

            console.log('[Heuristics] Feedback recorded:', {
                parameterId,
                error,
                newWeight: currentWeight.toFixed(3),
                accuracy: weight.accuracy.toFixed(2)
            });

            return weight;
        } catch (error) {
            console.error('[Heuristics] Error recording feedback:', error);
            return null;
        }
    }

    /**
     * Obtener mejora de precisión acumulada
     */
    async getPrecisionImprovement() {
        try {
            const weights = await roadsignDB.getAllWeights();
            const improvements = weights.map((w) => ({
                parameterId: w.parameterId,
                adjustment: w.adjustment,
                accuracy: w.accuracy
            }));

            const totalAdjustment = improvements.reduce((sum, w) => sum + w.adjustment, 0);
            const avgAccuracy = improvements.length > 0 ? 
                improvements.reduce((sum, w) => sum + w.accuracy, 0) / improvements.length : 0;

            return {
                totalWeights: weights.length,
                totalAdjustment: totalAdjustment,
                averageAccuracy: avgAccuracy,
                improvements: improvements
            };
        } catch (error) {
            console.error('[Heuristics] Error getting improvements:', error);
            return null;
        }
    }
}

// Crear instancia global del engine de heurísticas
const heuristicsEngine = new HeuristicsEngine();

console.log('[Heuristics] Module loaded');
