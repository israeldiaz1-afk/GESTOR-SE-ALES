/**
 * RoadSign Camera Manager
 * Maneja acceso a cámara, captura de video y fotos
 */

class CameraManager {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.isStreaming = false;
        this.currentFrame = null;
        this.fpsCounter = 0;
        this.lastFpsTime = Date.now();
        this.frameCounter = 0;
    }

    /**
     * Inicializar el gestor de cámara
     */
    async init() {
        this.video = document.getElementById('video-preview');
        this.canvas = document.createElement('canvas');

        try {
            // Solicitar permisos
            const constraints = {
                video: {
                    facingMode: 'environment', // Cámara trasera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    aspectRatio: { ideal: 16 / 9 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (this.video) {
                this.video.srcObject = this.stream;
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    this.isStreaming = true;
                    console.log('[Camera] Video stream started');
                    this.startFPSCounter();
                };
            }

            return true;
        } catch (error) {
            console.error('[Camera] Error accessing camera:', error);
            this.handleCameraError(error);
            return false;
        }
    }

    /**
     * Manejar errores de cámara
     */
    handleCameraError(error) {
        if (error.name === 'NotAllowedError') {
            alert('Necesitas permitir el acceso a la cámara para usar esta app');
        } else if (error.name === 'NotFoundError') {
            alert('No se encontró ninguna cámara en el dispositivo');
        } else if (error.name === 'NotReadableError') {
            alert('La cámara está siendo utilizada por otra aplicación');
        } else {
            alert('Error al acceder a la cámara: ' + error.message);
        }
    }

    /**
     * Capturar frame actual
     */
    captureFrame() {
        if (!this.video || !this.isStreaming) {
            console.error('[Camera] Video not streaming');
            return null;
        }

        try {
            const ctx = this.canvas.getContext('2d');

            // Ajustar tamaño del canvas
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            // Espejo horizontal (porque estamos usando facingMode environment)
            ctx.scale(-1, 1);
            ctx.drawImage(this.video, -this.video.videoWidth, 0);
            ctx.scale(-1, 1);

            // Obtener imagen en base64
            const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
            this.currentFrame = imageData;

            return imageData;
        } catch (error) {
            console.error('[Camera] Error capturing frame:', error);
            return null;
        }
    }

    /**
     * Capturar foto (con resolución más alta)
     */
    async capturePhoto() {
        if (!this.stream) {
            console.error('[Camera] Stream not available');
            return null;
        }

        try {
            const track = this.stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();

            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const ctx = canvas.getContext('2d');

            // Espejo horizontal
            ctx.scale(-1, 1);
            ctx.drawImage(bitmap, -bitmap.width, 0);

            const photoData = canvas.toDataURL('image/jpeg', 0.9);
            return photoData;
        } catch (error) {
            console.error('[Camera] Error capturing photo:', error);
            // Fallback: usar frame actual
            return this.captureFrame();
        }
    }

    /**
     * Iniciar contador de FPS
     */
    startFPSCounter() {
        if (!this.isStreaming) return;

        requestAnimationFrame(() => {
            this.frameCounter++;

            const now = Date.now();
            const elapsed = now - this.lastFpsTime;

            if (elapsed >= 1000) {
                this.fpsCounter = this.frameCounter;
                this.frameCounter = 0;
                this.lastFpsTime = now;

                // Actualizar UI
                const fpsElement = document.getElementById('fps-counter');
                if (fpsElement) {
                    fpsElement.textContent = `FPS: ${this.fpsCounter}`;
                }
            }

            this.startFPSCounter();
        });
    }

    /**
     * Obtener FPS actual
     */
    getFPS() {
        return this.fpsCounter;
    }

    /**
     * Detener stream de video
     */
    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => {
                track.stop();
            });
            this.stream = null;
            this.isStreaming = false;
            console.log('[Camera] Video stream stopped');
        }
    }

    /**
     * Pausa/Resume stream
     */
    pauseStream() {
        if (this.video) {
            this.video.pause();
            this.isStreaming = false;
        }
    }

    resumeStream() {
        if (this.video) {
            this.video.play();
            this.isStreaming = true;
        }
    }

    /**
     * Verificar disponibilidad de cámara
     */
    static async isAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some((device) => device.kind === 'videoinput');
        } catch (error) {
            console.error('[Camera] Error checking availability:', error);
            return false;
        }
    }

    /**
     * Obtener información de dispositivos de video
     */
    static async getVideoDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter((device) => device.kind === 'videoinput');
        } catch (error) {
            console.error('[Camera] Error getting video devices:', error);
            return [];
        }
    }

    /**
     * Obtener frame actual
     */
    getCurrentFrame() {
        return this.currentFrame;
    }

    /**
     * Verificar si está grabando
     */
    isRecording() {
        return this.isStreaming;
    }
}

// Crear instancia global del gestor de cámara
const cameraManager = new CameraManager();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar disponibilidad de cámara
    const available = await CameraManager.isAvailable();
    if (!available) {
        console.warn('[Camera] No camera found on device');
    }

    // Inicializar cuando se inicia sesión
    const originalStartSession = modesManager.startSession.bind(modesManager);
    modesManager.startSession = function() {
        originalStartSession();

        // Inicializar cámara después de cambiar a la pantalla de captura
        setTimeout(async () => {
            await cameraManager.init();
        }, 500);
    };

    // Detener cámara al parar sesión
    const stopButton = document.getElementById('btn-stop-session');
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            cameraManager.stopStream();
            modesManager.stopSession();
        });
    }

    // Botón de confirmación
    const confirmButton = document.getElementById('btn-confirm-suggestion');
    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            const photo = await cameraManager.capturePhoto();
            console.log('[Camera] Photo captured');
        });
    }
});

console.log('[Camera] Module loaded');
