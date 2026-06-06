/**
 * Feature Extractor Module
 * Extrae características de imágenes para el modelo de IA
 */

class FeatureExtractor {
    constructor() {
        this.mobileNet = null;
        this.isInitialized = false;
    }

    /**
     * Inicializar extractor con MobileNet pre-entrenado
     */
    async init() {
        try {
            console.log('[FeatureExtractor] Initializing MobileNet...');
            
            // Cargar MobileNet desde CDN
            this.mobileNet = await tf.loadLayersModel(
                'https://storage.googleapis.com/tfjs-models/tfjs-models/mobilenet_v1/web_model.json'
            );

            console.log('[FeatureExtractor] MobileNet loaded successfully');
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('[FeatureExtractor] Initialization error:', error);
            return false;
        }
    }

    /**
     * Extraer características de una imagen
     */
    async extractFeatures(imageElement) {
        if (!this.isInitialized) {
            console.error('[FeatureExtractor] Not initialized');
            return null;
        }

        try {
            // Convertir imagen a tensor
            let imageTensor = tf.browser.fromPixels(imageElement);
            
            // Redimensionar a 224x224 (entrada de MobileNet)
            imageTensor = tf.image.resizeBilinear(imageTensor, [224, 224]);
            
            // Normalizar (valores entre -1 y 1)
            imageTensor = imageTensor.div(tf.scalar(127.5)).sub(tf.scalar(1));
            
            // Agregar dimensión de batch
            const batchTensor = imageTensor.expandDims(0);
            
            // Extraer características usando MobileNet
            const features = this.mobileNet.predict(batchTensor);
            
            // Convertir a array
            const featuresArray = await features.data();
            
            // Limpiar tensores
            tf.dispose([imageTensor, batchTensor, features]);
            
            console.log('[FeatureExtractor] Features extracted, shape:', features.shape);
            
            return Array.from(featuresArray);
        } catch (error) {
            console.error('[FeatureExtractor] Error extracting features:', error);
            return null;
        }
    }

    /**
     * Extraer características de color dominante
     */
    extractColorFeatures(imageElement) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');
            
            // Redimensionar imagen
            ctx.drawImage(imageElement, 0, 0, 50, 50);
            
            // Obtener datos de píxeles
            const imageData = ctx.getImageData(0, 0, 50, 50);
            const data = imageData.data;
            
            // Calcular promedios de color
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }
            
            const pixelCount = data.length / 4;
            r = Math.round(r / pixelCount);
            g = Math.round(g / pixelCount);
            b = Math.round(b / pixelCount);
            
            return { r, g, b };
        } catch (error) {
            console.error('[FeatureExtractor] Error extracting color:', error);
            return { r: 0, g: 0, b: 0 };
        }
    }

    /**
     * Extraer características de forma (usando contornos)
     */
    extractShapeFeatures(imageElement) {
        try {
            // Crear canvas para procesamiento
            const canvas = document.createElement('canvas');
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            const ctx = canvas.getContext('2d');
            
            // Dibujar imagen
            ctx.drawImage(imageElement, 0, 0);
            
            // Obtener datos de píxeles
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Calcular área, perímetro, etc.
            let pixelCount = 0;
            for (let i = 0; i < data.length; i += 4) {
                // Contar píxeles no blancos
                if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) {
                    pixelCount++;
                }
            }
            
            const area = pixelCount;
            const perimeter = Math.sqrt(area) * 4; // Aproximación
            const compactness = (perimeter * perimeter) / area; // Factor de compacidad
            
            return {
                area: area,
                perimeter: perimeter,
                compactness: compactness
            };
        } catch (error) {
            console.error('[FeatureExtractor] Error extracting shape:', error);
            return { area: 0, perimeter: 0, compactness: 0 };
        }
    }

    /**
     * Obtener todas las características combinadas
     */
    async getAllFeatures(imageElement) {
        const deepFeatures = await this.extractFeatures(imageElement);
        const colorFeatures = this.extractColorFeatures(imageElement);
        const shapeFeatures = this.extractShapeFeatures(imageElement);
        
        return {
            deepFeatures: deepFeatures,  // Array de 1000 características
            colorFeatures: colorFeatures, // RGB
            shapeFeatures: shapeFeatures, // área, perímetro, compacidad
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.mobileNet) {
            this.mobileNet.dispose();
            this.mobileNet = null;
        }
        tf.disposeVariables();
        this.isInitialized = false;
    }
}

console.log('[FeatureExtractor] Module loaded');
