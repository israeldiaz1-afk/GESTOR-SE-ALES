'use strict';
/* ══════════════════════════════════════════════
   PARAMETERS.JS — Definición de los 9 parámetros
   de evaluación de señalización vial (DGT / Norma)
   ══════════════════════════════════════════════ */

const PARAMS = [
  {
    id: 'visibilidad',
    label: 'Visibilidad',
    icon: '👁️',
    weight: 0.15,
    description: 'Detectabilidad a distancia adecuada',
    levels: [
      { value: 1, label: 'Nula',      desc: 'Invisible u oculta completamente' },
      { value: 2, label: 'Muy baja',  desc: 'Solo visible a menos de 20m' },
      { value: 3, label: 'Aceptable', desc: 'Visible pero con obstrucciones parciales' },
      { value: 4, label: 'Buena',     desc: 'Visible desde distancia correcta' },
      { value: 5, label: 'Óptima',    desc: 'Visibilidad excelente sin obstáculos' },
    ],
    // Factores visuales que influyen en la detección IA
    aiFactors: ['bbox_size', 'occlusion_ratio', 'contrast_with_background'],
  },
  {
    id: 'retroreflectancia',
    label: 'Retroreflectancia',
    icon: '💡',
    weight: 0.15,
    description: 'Nivel de reflexión luminosa nocturna (RA)',
    levels: [
      { value: 1, label: 'Sin reflec.',  desc: 'Lámina completamente degradada (<10 cd/lux·m²)' },
      { value: 2, label: 'Muy baja',     desc: 'Por debajo de mínimos normativos' },
      { value: 3, label: 'Mínima',       desc: 'Cumple mínimos (Clase RA1)' },
      { value: 4, label: 'Buena',        desc: 'Clase RA2 – supera mínimos' },
      { value: 5, label: 'Excelente',    desc: 'Clase RA3 – alta intensidad' },
    ],
    aiFactors: ['color_saturation', 'surface_uniformity', 'brightness_ratio'],
  },
  {
    id: 'legibilidad',
    label: 'Legibilidad',
    icon: '🔤',
    weight: 0.13,
    description: 'Claridad del texto y pictograma',
    levels: [
      { value: 1, label: 'Ilegible',    desc: 'Texto/pictograma irreconocible' },
      { value: 2, label: 'Muy difícil', desc: 'Solo legible a muy corta distancia' },
      { value: 3, label: 'Aceptable',   desc: 'Legible pero con esfuerzo' },
      { value: 4, label: 'Clara',       desc: 'Lectura fácil a distancia correcta' },
      { value: 5, label: 'Perfecta',    desc: 'Perfectamente legible en condiciones normales' },
    ],
    aiFactors: ['edge_sharpness', 'text_contrast', 'symbol_integrity'],
  },
  {
    id: 'estado_fisico',
    label: 'Estado físico',
    icon: '🔧',
    weight: 0.12,
    description: 'Integridad física del panel (golpes, dobleces)',
    levels: [
      { value: 1, label: 'Destruida',   desc: 'Rota, doblada o faltante' },
      { value: 2, label: 'Muy dañada',  desc: 'Daños graves que afectan la función' },
      { value: 3, label: 'Deteriorada', desc: 'Daños visibles pero funcional' },
      { value: 4, label: 'Buena',       desc: 'Pequeños desperfectos superficiales' },
      { value: 5, label: 'Perfecta',    desc: 'Sin daños apreciables' },
    ],
    aiFactors: ['shape_deformation', 'edge_damage', 'panel_completeness'],
  },
  {
    id: 'color_contraste',
    label: 'Color / Contraste',
    icon: '🎨',
    weight: 0.12,
    description: 'Conservación del color original y contraste',
    levels: [
      { value: 1, label: 'Decolorado',  desc: 'Sin color apreciable, irreconocible' },
      { value: 2, label: 'Muy faded',   desc: 'Color muy deteriorado' },
      { value: 3, label: 'Aceptable',   desc: 'Color reconocible pero degradado' },
      { value: 4, label: 'Bueno',       desc: 'Colores bien conservados' },
      { value: 5, label: 'Óptimo',      desc: 'Colores vivos según norma' },
    ],
    aiFactors: ['color_accuracy', 'saturation_loss', 'hue_deviation'],
  },
  {
    id: 'posicionamiento',
    label: 'Posicionamiento',
    icon: '📍',
    weight: 0.10,
    description: 'Altura, lateralidad y orientación correctas',
    levels: [
      { value: 1, label: 'Incorrecto',  desc: 'Fuera de lugar o caída' },
      { value: 2, label: 'Muy mal',     desc: 'Posición inadecuada significativa' },
      { value: 3, label: 'Tolerable',   desc: 'Pequeñas desviaciones de norma' },
      { value: 4, label: 'Correcto',    desc: 'Posición adecuada' },
      { value: 5, label: 'Óptimo',      desc: 'Posición perfecta según 8.1-IC' },
    ],
    aiFactors: ['tilt_angle', 'height_estimate', 'lateral_position'],
  },
  {
    id: 'cumplimiento_norma',
    label: 'Cumplimiento norma',
    icon: '📋',
    weight: 0.10,
    description: 'Adecuación al tipo de vía y situación (Norma 8.1-IC)',
    levels: [
      { value: 1, label: 'Incumple',    desc: 'Señal incorrecta para la situación' },
      { value: 2, label: 'Inadecuada',  desc: 'Tipo o tamaño incorrecto' },
      { value: 3, label: 'Parcial',     desc: 'Cumplimiento parcial' },
      { value: 4, label: 'Correcto',    desc: 'Cumple con la normativa' },
      { value: 5, label: 'Ejemplar',    desc: 'Cumple y supera requerimientos' },
    ],
    aiFactors: ['sign_type_match', 'size_appropriateness', 'context_match'],
  },
  {
    id: 'limpieza',
    label: 'Limpieza',
    icon: '🧹',
    weight: 0.08,
    description: 'Ausencia de suciedad, grafitis, adhesivos',
    levels: [
      { value: 1, label: 'Muy sucia',   desc: 'Grafiti o suciedad que impide lectura' },
      { value: 2, label: 'Sucia',       desc: 'Suciedad importante' },
      { value: 3, label: 'Aceptable',   desc: 'Suciedad leve' },
      { value: 4, label: 'Limpia',      desc: 'Limpia con pequeñas manchas' },
      { value: 5, label: 'Impecable',   desc: 'Sin suciedad apreciable' },
    ],
    aiFactors: ['texture_uniformity', 'noise_patches', 'graffiti_detection'],
  },
  {
    id: 'soporte',
    label: 'Soporte / Poste',
    icon: '🏗️',
    weight: 0.05,
    description: 'Estado del soporte o poste de sustentación',
    levels: [
      { value: 1, label: 'Caído',       desc: 'Poste tumbado o ausente' },
      { value: 2, label: 'Muy dañado',  desc: 'Oxidado gravemente o doblado' },
      { value: 3, label: 'Regular',     desc: 'Deterioro visible pero funcional' },
      { value: 4, label: 'Bueno',       desc: 'Ligero deterioro superficial' },
      { value: 5, label: 'Óptimo',      desc: 'Soporte en perfecto estado' },
    ],
    aiFactors: ['pole_visible', 'pole_verticality', 'rust_detection'],
  },
];

// Calcula rating ponderado 0-100 a partir de valores {paramId: 1-5}
function calcRating(values) {
  let total = 0;
  for (const p of PARAMS) {
    const v = values[p.id] ?? 3; // default 3 si no hay valor
    total += (v / 5) * p.weight;
  }
  return Math.round(total * 100);
}

// Convierte rating a clase CSS
function ratingClass(rating) {
  if (rating >= 85) return 'rating-excellent';
  if (rating >= 70) return 'rating-good';
  if (rating >= 50) return 'rating-average';
  if (rating >= 30) return 'rating-poor';
  return 'rating-critical';
}

// Convierte rating a etiqueta
function ratingLabel(rating) {
  if (rating >= 85) return 'Excelente';
  if (rating >= 70) return 'Buena';
  if (rating >= 50) return 'Aceptable';
  if (rating >= 30) return 'Deficiente';
  return 'Crítica';
}

// Color para gauge
function ratingColor(rating) {
  if (rating >= 85) return '#22c55e';
  if (rating >= 70) return '#84cc16';
  if (rating >= 50) return '#f5c518';
  if (rating >= 30) return '#f97316';
  return '#ef4444';
}
