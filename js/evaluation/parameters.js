'use strict';
const PARAMS = [
  {id:'visibilidad',label:'Visibilidad',icon:'👁️',weight:0.15,description:'Detectabilidad a distancia adecuada',
    levels:[{value:1,label:'Nula'},{value:2,label:'Muy baja'},{value:3,label:'Aceptable'},{value:4,label:'Buena'},{value:5,label:'Óptima'}]},
  {id:'retroreflectancia',label:'Retroreflectancia',icon:'💡',weight:0.15,description:'Nivel de reflexión luminosa (RA)',
    levels:[{value:1,label:'Sin reflec.'},{value:2,label:'Muy baja'},{value:3,label:'Mínima'},{value:4,label:'Buena'},{value:5,label:'Excelente'}]},
  {id:'legibilidad',label:'Legibilidad',icon:'🔤',weight:0.13,description:'Claridad del texto y pictograma',
    levels:[{value:1,label:'Ilegible'},{value:2,label:'Muy difícil'},{value:3,label:'Aceptable'},{value:4,label:'Clara'},{value:5,label:'Perfecta'}]},
  {id:'estado_fisico',label:'Estado físico',icon:'🔧',weight:0.12,description:'Integridad física del panel',
    levels:[{value:1,label:'Destruida'},{value:2,label:'Muy dañada'},{value:3,label:'Deteriorada'},{value:4,label:'Buena'},{value:5,label:'Perfecta'}]},
  {id:'color_contraste',label:'Color / Contraste',icon:'🎨',weight:0.12,description:'Conservación del color y contraste',
    levels:[{value:1,label:'Decolorado'},{value:2,label:'Muy faded'},{value:3,label:'Aceptable'},{value:4,label:'Bueno'},{value:5,label:'Óptimo'}]},
  {id:'posicionamiento',label:'Posicionamiento',icon:'📍',weight:0.10,description:'Altura, lateralidad y orientación',
    levels:[{value:1,label:'Incorrecto'},{value:2,label:'Muy mal'},{value:3,label:'Tolerable'},{value:4,label:'Correcto'},{value:5,label:'Óptimo'}]},
  {id:'cumplimiento_norma',label:'Cumplimiento norma',icon:'📋',weight:0.10,description:'Adecuación a Norma 8.1-IC',
    levels:[{value:1,label:'Incumple'},{value:2,label:'Inadecuada'},{value:3,label:'Parcial'},{value:4,label:'Correcto'},{value:5,label:'Ejemplar'}]},
  {id:'limpieza',label:'Limpieza',icon:'🧹',weight:0.08,description:'Ausencia de suciedad y grafitis',
    levels:[{value:1,label:'Muy sucia'},{value:2,label:'Sucia'},{value:3,label:'Aceptable'},{value:4,label:'Limpia'},{value:5,label:'Impecable'}]},
  {id:'soporte',label:'Soporte / Poste',icon:'🏗️',weight:0.05,description:'Estado del soporte de sustentación',
    levels:[{value:1,label:'Caído'},{value:2,label:'Muy dañado'},{value:3,label:'Regular'},{value:4,label:'Bueno'},{value:5,label:'Óptimo'}]},
];

function calcRating(values){
  let total=0;
  for(const p of PARAMS){const v=values[p.id]??3;total+=(v/5)*p.weight;}
  return Math.round(total*100);
}
function ratingClass(r){return r>=85?'rating-excellent':r>=70?'rating-good':r>=50?'rating-average':r>=30?'rating-poor':'rating-critical';}
function ratingLabel(r){return r>=85?'Excelente':r>=70?'Buena':r>=50?'Aceptable':r>=30?'Deficiente':'Crítica';}
function ratingColor(r){return r>=85?'#22c55e':r>=70?'#84cc16':r>=50?'#f5c518':r>=30?'#f97316':'#ef4444';}
