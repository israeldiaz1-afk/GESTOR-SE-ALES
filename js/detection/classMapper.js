'use strict';
/* ═══════════════════════════════════════════════════════════
   CLASSMAPPER.JS — Traduce clases del modelo → catálogo DGT
   Los modelos GTSDB/GTSRB usan IDs numéricos (0-42 típicamente).
   Aquí mapeamos cada ID al signType de nuestro SIGN_CATALOG.
   Si usas otro modelo, ajusta GTSRB_TO_DGT o el labels.json.

   El mapa por defecto cubre el GTSRB estándar (43 clases).
   Como las señales españolas siguen la Convención de Viena,
   la correspondencia es directa para la mayoría.
   ═══════════════════════════════════════════════════════════ */
const ClassMapper = (() => {

  // Mapa GTSRB (43 clases estándar) → catálogo DGT
  // Referencia: https://benchmark.ini.rub.de/gtsrb_news.html
  const GTSRB_TO_DGT = {
    0:  { signType:'R201', category:'velocidad' },    // Speed limit 20
    1:  { signType:'R201', category:'velocidad' },    // Speed limit 30
    2:  { signType:'R203', category:'velocidad' },    // Speed limit 50
    3:  { signType:'R204', category:'velocidad' },    // Speed limit 60
    4:  { signType:'R205', category:'velocidad' },    // Speed limit 70
    5:  { signType:'R206', category:'velocidad' },    // Speed limit 80
    6:  { signType:'R301', category:'velocidad' },    // End speed limit 80
    7:  { signType:'R206', category:'velocidad' },    // Speed limit 100
    8:  { signType:'R206', category:'velocidad' },    // Speed limit 120
    9:  { signType:'R103', category:'prohibicion' },  // No passing
    10: { signType:'R103', category:'prohibicion' },  // No passing trucks
    11: { signType:'P2',   category:'peligro' },      // Right-of-way intersection
    12: { signType:'R100', category:'prohibicion' },  // Priority road
    13: { signType:'R1',   category:'prioridad' },    // Yield
    14: { signType:'R2',   category:'prioridad' },    // Stop
    15: { signType:'R101', category:'prohibicion' },  // No vehicles
    16: { signType:'R101', category:'prohibicion' },  // No trucks
    17: { signType:'R100', category:'prohibicion' },  // No entry
    18: { signType:'P18',  category:'peligro' },      // General caution
    19: { signType:'P18',  category:'peligro' },      // Dangerous curve left
    20: { signType:'P18',  category:'peligro' },      // Dangerous curve right
    21: { signType:'P18',  category:'peligro' },      // Double curve
    22: { signType:'P25',  category:'peligro' },      // Bumpy road
    23: { signType:'P27',  category:'peligro' },      // Slippery road
    24: { signType:'P18',  category:'peligro' },      // Road narrows right
    25: { signType:'P18',  category:'peligro' },      // Road work
    26: { signType:'P2',   category:'peligro' },      // Traffic signals
    27: { signType:'P13',  category:'peligro' },      // Pedestrians
    28: { signType:'P13',  category:'peligro' },      // Children crossing
    29: { signType:'P18',  category:'peligro' },      // Bicycles crossing
    30: { signType:'P27',  category:'peligro' },      // Beware ice/snow
    31: { signType:'P18',  category:'peligro' },      // Wild animals
    32: { signType:'R301', category:'velocidad' },    // End all limits
    33: { signType:'M501', category:'obligacion' },   // Turn right ahead
    34: { signType:'M501', category:'obligacion' },   // Turn left ahead
    35: { signType:'M501', category:'obligacion' },   // Ahead only
    36: { signType:'M501', category:'obligacion' },   // Go straight or right
    37: { signType:'M501', category:'obligacion' },   // Go straight or left
    38: { signType:'M501', category:'obligacion' },   // Keep right
    39: { signType:'M501', category:'obligacion' },   // Keep left
    40: { signType:'M501', category:'obligacion' },   // Roundabout mandatory
    41: { signType:'R301', category:'velocidad' },    // End no passing
    42: { signType:'R301', category:'velocidad' },    // End no passing trucks
  };

  // Color por categoría (para dibujar y para fallback)
  const CATEGORY_COLOR = {
    velocidad:'red', prohibicion:'red', prioridad:'red',
    peligro:'yellow', obligacion:'blue', informacion:'blue',
    horizontal:'white', desconocido:'gray',
  };

  // Mapea una detección YOLO (classId + label) a nuestro formato
  function map(detection) {
    const id = detection.classId;
    let mapped = GTSRB_TO_DGT[id];

    // Si el modelo trae labels de texto, intentar inferir por nombre
    if (!mapped && detection.label) {
      mapped = _inferFromLabel(detection.label);
    }

    if (!mapped) {
      mapped = { signType:'UNKNOWN', category:'desconocido' };
    }

    const color = CATEGORY_COLOR[mapped.category] || 'gray';

    return {
      ...detection,
      signType: mapped.signType,
      category: mapped.category,
      color,
      dominantColor: color,
    };
  }

  // Inferencia básica por nombre de clase (para modelos con labels en texto)
  function _inferFromLabel(label) {
    const l = label.toLowerCase();
    if (l.includes('stop')) return { signType:'R2', category:'prioridad' };
    if (l.includes('yield') || l.includes('give way') || l.includes('ceda'))
      return { signType:'R1', category:'prioridad' };
    if (l.includes('speed') || l.includes('limit') || l.includes('velocidad'))
      return { signType:'R203', category:'velocidad' };
    if (l.includes('no entry') || l.includes('prohib'))
      return { signType:'R100', category:'prohibicion' };
    if (l.includes('pedestrian') || l.includes('peaton'))
      return { signType:'P13', category:'peligro' };
    if (l.includes('warning') || l.includes('caution') || l.includes('danger') || l.includes('peligro'))
      return { signType:'P18', category:'peligro' };
    if (l.includes('mandatory') || l.includes('turn') || l.includes('keep') || l.includes('oblig'))
      return { signType:'M501', category:'obligacion' };
    return null;
  }

  return { map };
})();
