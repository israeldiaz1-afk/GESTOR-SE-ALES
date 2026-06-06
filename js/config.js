// ============================================================
// RoadSign Evaluator — config.js
// Configuración global, catálogos y constantes
// ============================================================

const APP_VERSION = '1.0.0';
const DB_NAME = 'RoadSignEvaluatorDB';
const DB_VERSION = 1;

// ── Parámetros de evaluación ────────────────────────────────
const EVALUATION_PARAMS = {
  param_base: {
    label: 'Estado Base',
    description: 'Condición general visible de la señal',
    options: [
      { value: 'excelente', label: 'Excelente', score: 1.0 },
      { value: 'bueno',     label: 'Bueno',     score: 0.8 },
      { value: 'regular',  label: 'Regular',   score: 0.6 },
      { value: 'malo',     label: 'Malo',      score: 0.4 },
      { value: 'critico',  label: 'Crítico',   score: 0.0 },
    ],
    weight: 1.0,
    alwaysActive: true,
  },
  param_vandalism: {
    label: 'Vandalismo',
    description: 'Grafitis, roturas o decoloración intencionada',
    options: [
      { value: 'ninguno',   label: 'Ninguno',   penalty: 0.00 },
      { value: 'leve',      label: 'Leve',      penalty: 0.15 },
      { value: 'moderado',  label: 'Moderado',  penalty: 0.30 },
      { value: 'severo',    label: 'Severo',    penalty: 0.50 },
    ],
    weight: 0.50,
  },
  param_angle: {
    label: 'Ángulo de Visibilidad',
    description: 'Orientación y ángulo de visión del conductor',
    options: [
      { value: 'optimo',     label: 'Óptimo',    penalty: 0.00 },
      { value: 'bueno',      label: 'Bueno',     penalty: 0.10 },
      { value: 'aceptable',  label: 'Aceptable', penalty: 0.20 },
      { value: 'deficiente', label: 'Deficiente',penalty: 0.30 },
    ],
    weight: 0.30,
  },
  param_legibility: {
    label: 'Distancia de Legibilidad',
    description: 'Distancia a la que la señal puede leerse',
    options: [
      { value: 'gt300',     label: '>300 m',     penalty: 0.00 },
      { value: '200_300',   label: '200-300 m',  penalty: 0.08 },
      { value: '100_200',   label: '100-200 m',  penalty: 0.16 },
      { value: 'lt100',     label: '<100 m',     penalty: 0.25 },
    ],
    weight: 0.25,
  },
  param_maintenance: {
    label: 'Mantenimiento',
    description: 'Óxido, suciedad acumulada, deterioro estructural',
    options: [
      { value: 'excelente', label: 'Excelente', penalty: 0.00 },
      { value: 'bueno',     label: 'Bueno',     penalty: 0.05 },
      { value: 'regular',  label: 'Regular',   penalty: 0.12 },
      { value: 'pobre',    label: 'Pobre',     penalty: 0.20 },
    ],
    weight: 0.20,
    informative: true,
  },
  param_night_lighting: {
    label: 'Iluminación Nocturna',
    description: 'Reflectividad y visibilidad en condiciones nocturnas',
    options: [
      { value: 'optima',       label: 'Óptima',      penalty: 0.00 },
      { value: 'buena',        label: 'Buena',       penalty: 0.05 },
      { value: 'suficiente',   label: 'Suficiente',  penalty: 0.12 },
      { value: 'insuficiente', label: 'Insuficiente',penalty: 0.20 },
    ],
    weight: 0.20,
  },
  param_oxidation: {
    label: 'Oxidación / Corrosión',
    description: 'Presencia de óxido o corrosión en el soporte',
    options: [
      { value: 'ninguna',  label: 'Ninguna',  penalty: 0.00 },
      { value: 'leve',     label: 'Leve',     penalty: 0.08 },
      { value: 'moderada', label: 'Moderada', penalty: 0.18 },
      { value: 'severa',   label: 'Severa',   penalty: 0.28 },
    ],
    weight: 0.28,
  },
  param_reflectivity: {
    label: 'Reflectividad',
    description: 'Capacidad reflectante de la lámina de la señal',
    options: [
      { value: 'alta',  label: 'Alta',  penalty: 0.00 },
      { value: 'media', label: 'Media', penalty: 0.07 },
      { value: 'baja',  label: 'Baja',  penalty: 0.15 },
      { value: 'nula',  label: 'Nula',  penalty: 0.22 },
    ],
    weight: 0.22,
  },
  param_glass: {
    label: 'Limpieza de Cristal',
    description: 'Estado del cristal protector (si existe)',
    options: [
      { value: 'limpio',    label: 'Limpio',    penalty: 0.00 },
      { value: 'sucio',     label: 'Sucio',     penalty: 0.08 },
      { value: 'muy_sucio', label: 'Muy Sucio', penalty: 0.15 },
    ],
    weight: 0.15,
  },
};

// ── Catálogo de señales verticales (España / GTSRB compatible) ──
const VERTICAL_SIGNS = {
  // Prohibición
  SPEED_20:    { label: 'Límite 20 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 0  },
  SPEED_30:    { label: 'Límite 30 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 1  },
  SPEED_50:    { label: 'Límite 50 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 2  },
  SPEED_60:    { label: 'Límite 60 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 3  },
  SPEED_70:    { label: 'Límite 70 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 4  },
  SPEED_80:    { label: 'Límite 80 km/h',    color: '#e74c3c', category: 'prohibicion', gtsrb: 5  },
  END_SPEED_80:{ label: 'Fin límite 80',     color: '#95a5a6', category: 'prohibicion', gtsrb: 6  },
  SPEED_100:   { label: 'Límite 100 km/h',   color: '#e74c3c', category: 'prohibicion', gtsrb: 7  },
  SPEED_120:   { label: 'Límite 120 km/h',   color: '#e74c3c', category: 'prohibicion', gtsrb: 8  },
  NO_OVERTAKE: { label: 'Prohibido adelantar',color: '#e74c3c', category: 'prohibicion', gtsrb: 9  },
  NO_OVERTAKE_TRUCKS:{ label: 'No adelantar camiones', color: '#e74c3c', category: 'prohibicion', gtsrb: 10 },
  // Prioridad
  PRIORITY_ROAD: { label: 'Carretera prioritaria', color: '#f39c12', category: 'prioridad', gtsrb: 12 },
  YIELD:         { label: 'Ceda el Paso',    color: '#e74c3c', category: 'prioridad', gtsrb: 13 },
  STOP:          { label: 'Stop',            color: '#e74c3c', category: 'prohibicion', gtsrb: 14 },
  NO_ENTRY:      { label: 'Prohibido el paso', color: '#e74c3c', category: 'prohibicion', gtsrb: 17 },
  // Peligro / Advertencia
  WARN_CURVE_L:  { label: 'Curva izq.',      color: '#f39c12', category: 'advertencia', gtsrb: 19 },
  WARN_CURVE_R:  { label: 'Curva dcha.',     color: '#f39c12', category: 'advertencia', gtsrb: 20 },
  WARN_CURVES:   { label: 'Curvas',          color: '#f39c12', category: 'advertencia', gtsrb: 21 },
  WARN_BUMP:     { label: 'Resalto',         color: '#f39c12', category: 'advertencia', gtsrb: 22 },
  WARN_SLIPPERY: { label: 'Pavimento deslizante', color: '#f39c12', category: 'advertencia', gtsrb: 23 },
  WARN_NARROW:   { label: 'Estrech. calzada', color: '#f39c12', category: 'advertencia', gtsrb: 24 },
  WARN_WORKS:    { label: 'Obras',           color: '#f39c12', category: 'advertencia', gtsrb: 25 },
  WARN_TRAFFIC_LIGHT: { label: 'Semáforo',   color: '#f39c12', category: 'advertencia', gtsrb: 26 },
  WARN_PEDESTRIAN:    { label: 'Peatones',   color: '#f39c12', category: 'advertencia', gtsrb: 27 },
  WARN_CHILDREN:      { label: 'Niños',      color: '#f39c12', category: 'advertencia', gtsrb: 28 },
  WARN_BICYCLE:       { label: 'Ciclistas',  color: '#f39c12', category: 'advertencia', gtsrb: 29 },
  WARN_ICE:           { label: 'Hielo/Nieve', color: '#f39c12', category: 'advertencia', gtsrb: 30 },
  WARN_ANIMAL:        { label: 'Animales',   color: '#f39c12', category: 'advertencia', gtsrb: 31 },
  // Obligación
  END_ALL_RESTRICTIONS: { label: 'Fin restricciones', color: '#95a5a6', category: 'obligacion', gtsrb: 32 },
  ONLY_RIGHT:  { label: 'Solo dcha.',       color: '#2980b9', category: 'obligacion', gtsrb: 33 },
  ONLY_LEFT:   { label: 'Solo izq.',        color: '#2980b9', category: 'obligacion', gtsrb: 34 },
  ONLY_AHEAD:  { label: 'Solo recto',       color: '#2980b9', category: 'obligacion', gtsrb: 35 },
  AHEAD_RIGHT: { label: 'Recto/Dcha.',      color: '#2980b9', category: 'obligacion', gtsrb: 36 },
  AHEAD_LEFT:  { label: 'Recto/Izq.',       color: '#2980b9', category: 'obligacion', gtsrb: 37 },
  KEEP_RIGHT:  { label: 'Circular por la dcha.', color: '#2980b9', category: 'obligacion', gtsrb: 38 },
  KEEP_LEFT:   { label: 'Circular por la izq.',  color: '#2980b9', category: 'obligacion', gtsrb: 39 },
  ROUNDABOUT:  { label: 'Glorieta',         color: '#2980b9', category: 'obligacion', gtsrb: 40 },
  END_NO_OVERTAKE: { label: 'Fin prohibición adelantar', color: '#95a5a6', category: 'obligacion', gtsrb: 41 },
  END_NO_OVERTAKE_TRUCKS: { label: 'Fin prohibición adelantar camiones', color: '#95a5a6', category: 'obligacion', gtsrb: 42 },
  // Información
  UNKNOWN:     { label: 'Señal no identificada', color: '#7f8c8d', category: 'desconocida', gtsrb: -1 },
};

// ── Catálogo de señales horizontales ──────────────────────────
const HORIZONTAL_MARKINGS = {
  ARROW_STRAIGHT:    { label: 'Flecha recto',       color: '#3498db' },
  ARROW_LEFT:        { label: 'Flecha izquierda',   color: '#3498db' },
  ARROW_RIGHT:       { label: 'Flecha derecha',     color: '#3498db' },
  ARROW_UTURN:       { label: 'Flecha retorno',     color: '#3498db' },
  PEDESTRIAN_CROSS:  { label: 'Paso de peatones',   color: '#2ecc71' },
  STOP_LINE:         { label: 'Línea de stop',      color: '#e74c3c' },
  YIELD_LINE:        { label: 'Línea de ceda',      color: '#f39c12' },
  LINE_CONTINUOUS:   { label: 'Línea continua',     color: '#e74c3c' },
  LINE_DASHED:       { label: 'Línea discontinua',  color: '#95a5a6' },
  SPEED_TEXT:        { label: 'Texto velocidad',    color: '#e74c3c' },
  BUS_LANE:          { label: 'Carril bus',         color: '#9b59b6' },
  BIKE_LANE:         { label: 'Carril bici',        color: '#2ecc71' },
  PARKING_ZONE:      { label: 'Zona aparcamiento',  color: '#3498db' },
  UNKNOWN:           { label: 'Marca no identificada', color: '#7f8c8d' },
};

// ── Colores de bounding box por categoría ────────────────────
const BBOX_COLORS = {
  prohibicion: '#e74c3c',
  advertencia: '#f39c12',
  obligacion:  '#2980b9',
  prioridad:   '#8e44ad',
  informacion: '#27ae60',
  desconocida: '#7f8c8d',
  horizontal:  '#16a085',
};

// ── GTSRB label map (índice → clave en VERTICAL_SIGNS) ──────
const GTSRB_TO_SIGN = (() => {
  const map = {};
  for (const [key, val] of Object.entries(VERTICAL_SIGNS)) {
    if (val.gtsrb >= 0) map[val.gtsrb] = key;
  }
  return map;
})();

// ── Configuración de modelos ─────────────────────────────────
const MODEL_CONFIG = {
  cocoSsd: {
    // Cargado desde CDN de TF
    minConfidence: 0.35,
    classes: ['traffic light', 'stop sign', 'parking meter'],
  },
  mobilenet: {
    // MobileNet base para feature extraction
    inputSize: 224,
  },
  detection: {
    frameSkip: 3,           // Detectar cada N frames
    maxDetections: 10,
    inputWidth: 512,
    inputHeight: 384,
    minConfidenceShow: 0.40,
  },
};

// ── Configuración de captura ─────────────────────────────────
const CAMERA_CONFIG = {
  video: {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'environment',
  },
  maxImageSizeMB: 5,
  jpegQuality: 0.85,
};

// ── Límites de almacenamiento ────────────────────────────────
const STORAGE_LIMITS = {
  maxEvaluations: 5000,
  maxLearningEvents: 5000,
  maxImages: 1000,
  warningThresholdMB: 80,
};

// ── Exportar ─────────────────────────────────────────────────
window.RSConfig = {
  APP_VERSION,
  DB_NAME,
  DB_VERSION,
  EVALUATION_PARAMS,
  VERTICAL_SIGNS,
  HORIZONTAL_MARKINGS,
  BBOX_COLORS,
  GTSRB_TO_SIGN,
  MODEL_CONFIG,
  CAMERA_CONFIG,
  STORAGE_LIMITS,
};
