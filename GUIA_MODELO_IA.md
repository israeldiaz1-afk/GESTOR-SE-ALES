# Guía del Motor de IA — RoadSign Evaluator

## Cómo funciona ahora

La app tiene **dos motores de detección** y elige automáticamente:

1. **IA neuronal (YOLOv8)** — cuando existe `models/model.onnx`. Detecta y clasifica decenas de tipos de señal con precisión real, incluso en sombra, giradas o parcialmente tapadas.
2. **Detector de color (respaldo)** — si no hay modelo. Menos preciso, pero funciona al instante sin descargas.

No tienes que configurar nada: al abrir la app comprueba si el modelo está y activa el mejor motor disponible. Lo ves en **Ajustes → Sistema IA**.

## Generar el modelo (la forma fácil, 3 minutos)

1. Sube a tu Google Drive el archivo `colab/RoadSign_Generar_Modelo.ipynb`, o ábrelo directamente en [Google Colab](https://colab.research.google.com) con **Archivo → Subir cuaderno**.
2. En el menú: **Entorno de ejecución → Ejecutar todo**.
3. Espera 2-3 minutos. Al terminar se descargan solos `model.onnx` y `labels.json`.
4. Sube esos 2 archivos a la carpeta `models/` de tu repositorio de GitHub.
5. Abre la app (borra caché si hace falta). En Ajustes verás "Motor: YOLOv8 neuronal".

Eso es todo. No necesitas GPU, ni instalar Python, ni escribir código.

## La mejor imagen por señal (modo vídeo)

Mientras grabas, la app no se queda con el último fotograma de cada señal, sino con **el mejor**. Cada vez que detecta una señal calcula una puntuación de calidad que combina:

- **Nitidez** (42%) — descarta fotogramas movidos midiendo el enfoque real
- **Tamaño** (30%) — señales más cercanas tienen más detalle
- **Confianza** (18%) — cuán segura está la red
- **Centrado** (10%) — las señales centradas suelen captarse mejor

Agrupa las apariciones de la misma señal física (por posición y tipo) y al pulsar "Evaluar señales" cada una se califica sobre su captura óptima.

## Afinar tu propio modelo (avanzado, opcional)

Si quieres máxima precisión con señales **específicamente españolas**, puedes entrenar tu propio modelo. Esto sí lleva más trabajo pero da el mejor resultado. Resumen del proceso:

### 1. Conseguir datos
Necesitas imágenes de señales españolas etiquetadas (con cajas). Opciones:
- **Roboflow Universe** (roboflow.com/universe) — busca "spanish traffic signs" o "GTSDB"; muchos datasets descargables en formato YOLO.
- **Mapillary** (mapillary.com) — imágenes reales de calles con señales etiquetadas.
- **Tu propio dataset** — fotos tuyas etiquetadas con la herramienta gratuita de Roboflow o CVAT.

Cuantas más imágenes y más variadas (luz, ángulos, clima), mejor. Con 500-1000 imágenes por tipo de señal ya se obtienen buenos resultados.

### 2. Entrenar (en Google Colab con GPU gratis)
```python
from ultralytics import YOLO

# Partir del modelo nano pre-entrenado (transfer learning)
model = YOLO('yolov8n.pt')

# Entrenar con tu dataset (data.yaml lo genera Roboflow al exportar)
model.train(
    data='data.yaml',     # describe tus clases y rutas
    epochs=100,           # vueltas al dataset
    imgsz=640,
    batch=16,
    patience=20,          # para si deja de mejorar
)
```
En Colab: **Entorno de ejecución → Cambiar tipo → GPU T4** (gratis). 100 épocas con 1000 imágenes tardan ~1-2 horas.

### 3. Exportar a ONNX
```python
model.export(format='onnx', imgsz=640, opset=12, simplify=True)
```

### 4. Actualizar el mapa de clases
Si tu modelo usa clases distintas a las del GTSRB estándar, edita `js/detection/classMapper.js` para mapear cada `classId` de tu modelo al `signType` correspondiente de tu catálogo DGT. El `labels.json` que genera el entrenamiento te dice qué clase es cada índice.

### 5. Subir
Coloca `model.onnx` y `labels.json` en `models/` igual que antes.

### Consejo
Empieza con el modelo genérico del cuaderno de un clic. Solo si te quedas corto en algún tipo concreto de señal española merece la pena el esfuerzo de afinar uno propio.
