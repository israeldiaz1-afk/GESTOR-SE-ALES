/**
 * Signal Classifier Module
 * Clasificador de señales de tráfico con IA
 */

class SignalClassifier {
    constructor() {
        this.featureExtractor = null;
        this.aiModel = null;
        this.isInitialized = false;
        this.classificationHistory = [];
    }

    /**
     * Inicializar clasificador
     */
    async init() {
        try {
            console.log('[SignalClassifier] Initializing...');

            // Inicializar extractor de características
            this.featureExtractor = new FeatureExtractor();
            const extractorReady = await this.featureExtractor.init();
            
            if (!extractorReady) {
                console.warn('[SignalClassifier] Feature extractor initialization failed');
            }

            // Inicializar modelo de IA
            this.aiModel = new AIModel();
            await this.aiModel.loadModel();

            this.isInitialized = true;
            console.log('[SignalClassifier] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[SignalClassifier] Initialization error:', error);
            return false;
        }
    }

    /**
     * Clasificar imagen de señal
     */
    async classifySignal(imageElement) {
        if (!this.isInitialized) {
            console.error('[SignalClassifier] Not initialized');
            return null;
        }

        try {
            console.log('[SignalClassifier] Classifying signal...');

            // Extraer características
            const features = await this.featureExtractor.getAllFeatures(imageElement);
            
            // Predicción
            const prediction = await this.aiModel.predict(features);
            
            if (!prediction) {
                console.error('[SignalClassifier] Prediction failed');
                return null;
            }

            // Crear objeto de clasificación
            const classification = {
                timestamp: new Date().toISOString(),
                signalType: prediction.signalType,
                confidence: prediction.confidence,
                allPredictions: prediction.allPredictions,
                features: features,
                verified: false  // Sin verificación del usuario aún
            };

            // Registrar en histórico
            this.classificationHistory.push(classification);

            console.log('[SignalClassifier] Classification:', classification);
            return classification;
        } catch (error) {
            console.error('[SignalClassifier] Classification error:', error);
            return null;
        }
    }

    /**
     * Entrenar modelo con datos de usuario
     */
    async trainWithUserData(trainingDataset, epochs = 10) {
        if (!this.aiModel) {
            console.error('[SignalClassifier] Model not initialized');
            return false;
        }

        try {
            console.log('[SignalClassifier] Training with', trainingDataset.length, 'samples...');
            
            const success = await this.aiModel.train(trainingDataset, epochs);
            
            if (success) {
                await this.aiModel.saveModel();
                console.log('[SignalClassifier] Training completed and model saved');
            }
            
            return success;
        } catch (error) {
            console.error('[SignalClassifier] Training error:', error);
            return false;
        }
    }

    /**
     * Corregir predicción con feedback del usuario
     */
    async correctPrediction(classificationIndex, correctSignalType) {
        if (classificationIndex >= this.classificationHistory.length) {
            console.error('[SignalClassifier] Invalid classification index');
            return false;
        }

        try {
            const classification = this.classificationHistory[classificationIndex];
            
            // Marcar como verificado
            classification.verified = true;
            classification.correctedSignalType = correctSignalType;
            classification.wasWrong = classification.signalType !== correctSignalType;
            
            // Si la predicción fue incorrecta, registrar para aprendizaje
            if (classification.wasWrong) {
                console.log('[SignalClassifier] Incorrect prediction detected, learning from correction');
                // El modelo puede usar esto para fine-tuning
            }

            console.log('[SignalClassifier] Classification corrected:', classification);
            return true;
        } catch (error) {
            console.error('[SignalClassifier] Error correcting prediction:', error);
            return false;
        }
    }

    /**
     * Obtener estadísticas de clasificación
     */
    getClassificationStats() {
        const verified = this.classificationHistory.filter(c => c.verified);
        const correct = verified.filter(c => !c.wasWrong);
        
        return {
            totalClassifications: this.classificationHistory.length,
            verifiedClassifications: verified.length,
            correctClassifications: correct.length,
            accuracy: verified.length > 0 ? (correct.length / verified.length) * 100 : 0,
            averageConfidence: this.classificationHistory.length > 0 
                ? (this.classificationHistory.reduce((sum, c) => sum + c.confidence, 0) / this.classificationHistory.length)
                : 0,
            history: this.classificationHistory
        };
    }

    /**
     * Exportar histórico de clasificaciones
     */
    exportClassificationHistory() {
        return this.classificationHistory.map(c => ({
            'Fecha/Hora': c.timestamp,
            'Tipo de Señal Detectado': c.signalType,
            'Confianza': (c.confidence * 100).toFixed(2) + '%',
            'Tipo de Señal Correcto': c.correctedSignalType || 'No verificado',
            'Fue Correcto': c.wasWrong === undefined ? 'No verificado' : (!c.wasWrong ? 'Sí' : 'No')
        }));
    }

    /**
     * Limpiar histórico
     */
    clearHistory() {
        this.classificationHistory = [];
        console.log('[SignalClassifier] History cleared');
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.featureExtractor) {
            this.featureExtractor.cleanup();
        }
        if (this.aiModel) {
            this.aiModel.cleanup();
        }
        this.isInitialized = false;
    }
}

console.log('[SignalClassifier] Module loaded');
