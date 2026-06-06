/**
 * AI Model Module
 * Modelo neural para clasificación de señales de tráfico
 */

class AIModel {
    constructor() {
        this.model = null;
        this.isInitialized = false;
        this.signalTypes = [
            'stop',
            'yield',
            'speed_limit',
            'prohibition',
            'obligation',
            'information',
            'warning',
            'unknown'
        ];
        this.trainingHistory = [];
    }

    /**
     * Construir modelo neural desde cero
     */
    async buildModel() {
        try {
            console.log('[AIModel] Building neural network...');
            
            this.model = tf.sequential({
                layers: [
                    // Capa de entrada: 1000 características de MobileNet + 5 características adicionales
                    tf.layers.dense({
                        inputShape: [1005],
                        units: 512,
                        activation: 'relu',
                        name: 'dense_1'
                    }),
                    
                    // Dropout para regularización
                    tf.layers.dropout({ rate: 0.3 }),
                    
                    // Capas intermedias
                    tf.layers.dense({
                        units: 256,
                        activation: 'relu',
                        name: 'dense_2'
                    }),
                    
                    tf.layers.dropout({ rate: 0.3 }),
                    
                    tf.layers.dense({
                        units: 128,
                        activation: 'relu',
                        name: 'dense_3'
                    }),
                    
                    tf.layers.dropout({ rate: 0.2 }),
                    
                    // Capa de salida: 8 tipos de señales
                    tf.layers.dense({
                        units: this.signalTypes.length,
                        activation: 'softmax',
                        name: 'output'
                    })
                ]
            });

            // Compilar modelo
            this.model.compile({
                optimizer: tf.train.adam(0.001),
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            console.log('[AIModel] Model built successfully');
            this.model.summary();
            
            return true;
        } catch (error) {
            console.error('[AIModel] Error building model:', error);
            return false;
        }
    }

    /**
     * Cargar modelo pre-entrenado desde almacenamiento
     */
    async loadModel(modelName = 'signal-classifier') {
        try {
            console.log('[AIModel] Loading pre-trained model...');
            
            const modelPath = `indexeddb://${modelName}`;
            this.model = await tf.loadLayersModel(modelPath);
            
            console.log('[AIModel] Pre-trained model loaded');
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.log('[AIModel] No pre-trained model found, building new one...');
            const built = await this.buildModel();
            if (built) this.isInitialized = true;
            return built;
        }
    }

    /**
     * Entrenar modelo con datos
     */
    async train(trainingData, epochs = 10, batchSize = 32) {
        if (!this.model) {
            console.error('[AIModel] Model not initialized');
            return false;
        }

        try {
            console.log('[AIModel] Starting training...');
            
            // Preparar datos
            const features = tf.tensor2d(trainingData.map(d => [
                ...d.deepFeatures,
                d.colorFeatures.r / 255,
                d.colorFeatures.g / 255,
                d.colorFeatures.b / 255,
                d.shapeFeatures.compactness / 100,
                d.shapeFeatures.area / 10000
            ]));
            
            const labels = tf.tensor2d(trainingData.map(d => {
                const label = new Array(this.signalTypes.length).fill(0);
                const index = this.signalTypes.indexOf(d.signalType);
                if (index >= 0) label[index] = 1;
                return label;
            }));

            // Entrenar
            const history = await this.model.fit(features, labels, {
                epochs: epochs,
                batchSize: batchSize,
                validationSplit: 0.2,
                verbose: 1,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                        this.trainingHistory.push({
                            epoch: epoch,
                            loss: logs.loss,
                            accuracy: logs.acc
                        });
                    }
                }
            });

            // Limpiar tensores
            tf.dispose([features, labels]);

            console.log('[AIModel] Training complete');
            return true;
        } catch (error) {
            console.error('[AIModel] Training error:', error);
            return false;
        }
    }

    /**
     * Predecir tipo de señal
     */
    async predict(features) {
        if (!this.model) {
            console.error('[AIModel] Model not initialized');
            return null;
        }

        try {
            // Preparar features
            const inputTensor = tf.tensor2d([[
                ...features.deepFeatures,
                features.colorFeatures.r / 255,
                features.colorFeatures.g / 255,
                features.colorFeatures.b / 255,
                features.shapeFeatures.compactness / 100,
                features.shapeFeatures.area / 10000
            ]]);

            // Predicción
            const predictions = this.model.predict(inputTensor);
            const predictionsArray = await predictions.data();

            // Obtener clase y confianza
            let maxConfidence = 0;
            let predictedClass = 0;
            
            for (let i = 0; i < predictionsArray.length; i++) {
                if (predictionsArray[i] > maxConfidence) {
                    maxConfidence = predictionsArray[i];
                    predictedClass = i;
                }
            }

            // Limpiar tensores
            tf.dispose([inputTensor, predictions]);

            const result = {
                signalType: this.signalTypes[predictedClass],
                confidence: maxConfidence,
                allPredictions: {}
            };

            // Agregar todas las predicciones
            for (let i = 0; i < this.signalTypes.length; i++) {
                result.allPredictions[this.signalTypes[i]] = predictionsArray[i];
            }

            console.log('[AIModel] Prediction:', result);
            return result;
        } catch (error) {
            console.error('[AIModel] Prediction error:', error);
            return null;
        }
    }

    /**
     * Guardar modelo entrenado
     */
    async saveModel(modelName = 'signal-classifier') {
        if (!this.model) {
            console.error('[AIModel] Model not initialized');
            return false;
        }

        try {
            console.log('[AIModel] Saving model...');
            
            await this.model.save(`indexeddb://${modelName}`);
            
            console.log('[AIModel] Model saved successfully');
            return true;
        } catch (error) {
            console.error('[AIModel] Error saving model:', error);
            return false;
        }
    }

    /**
     * Obtener estadísticas de entrenamiento
     */
    getTrainingStats() {
        if (this.trainingHistory.length === 0) {
            return null;
        }

        const losses = this.trainingHistory.map(h => h.loss);
        const accuracies = this.trainingHistory.map(h => h.accuracy);

        return {
            totalEpochs: this.trainingHistory.length,
            finalLoss: losses[losses.length - 1],
            finalAccuracy: accuracies[accuracies.length - 1],
            bestAccuracy: Math.max(...accuracies),
            averageLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
            history: this.trainingHistory
        };
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.isInitialized = false;
    }
}

console.log('[AIModel] Module loaded');
