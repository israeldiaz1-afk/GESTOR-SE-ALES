'use strict';
const APP_CONFIG = {
  version:'1.1.0',region:'ES',dbName:'roadsign_db',dbVersion:3,
  detection:{cocoConfidence:0.45,maxDetectionsPerFrame:8,videoFPS:6,nmsThreshold:0.4,minSignPixels:40},
  cocoSignClasses:['stop sign','traffic light','parking meter'],
  camera:{facingMode:'environment',idealWidth:1280,idealHeight:720},
  gps:{timeout:10000,maximumAge:5000,enableHighAccuracy:true},
  evaluation:{paramWeights:{visibilidad:0.15,retroreflectancia:0.15,legibilidad:0.13,
    estado_fisico:0.12,color_contraste:0.12,posicionamiento:0.10,
    cumplimiento_norma:0.10,limpieza:0.08,soporte:0.05}},
  learning:{minSamplesForAdjust:5,maxStoredEvents:2000},
  export:{csvSeparator:';'},
};

const SIGN_CATALOG = {
  R2:   {label:'STOP — Detención obligatoria',   category:'prioridad',   icon:'🛑', color:'#ef4444'},
  R1:   {label:'Ceda el paso',                   category:'prioridad',   icon:'🔺', color:'#ef4444'},
  R100: {label:'Entrada prohibida',              category:'prohibicion', icon:'🚫', color:'#ef4444'},
  R101: {label:'Circulación prohibida',          category:'prohibicion', icon:'🚫', color:'#ef4444'},
  R103: {label:'Prohibido adelantar',            category:'prohibicion', icon:'🚫', color:'#ef4444'},
  R200: {label:'Límite velocidad 20',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R201: {label:'Límite velocidad 30',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R202: {label:'Límite velocidad 40',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R203: {label:'Límite velocidad 50',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R204: {label:'Límite velocidad 60',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R205: {label:'Límite velocidad 70',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R206: {label:'Límite velocidad 80',            category:'velocidad',   icon:'🔴', color:'#ef4444'},
  R301: {label:'Fin de limitación',              category:'velocidad',   icon:'⚪', color:'#8899bb'},
  P2:   {label:'Semáforo',                       category:'peligro',     icon:'⚠️', color:'#f59e0b'},
  P13:  {label:'Peatones',                       category:'peligro',     icon:'⚠️', color:'#f59e0b'},
  P18:  {label:'Curva peligrosa',                category:'peligro',     icon:'⚠️', color:'#f59e0b'},
  P25:  {label:'Resalto',                        category:'peligro',     icon:'⚠️', color:'#f59e0b'},
  P27:  {label:'Superficie deslizante',          category:'peligro',     icon:'⚠️', color:'#f59e0b'},
  M501: {label:'Sentido obligatorio',            category:'obligacion',  icon:'🟢', color:'#22c55e'},
  S10:  {label:'Paso de peatones',               category:'informacion', icon:'🔵', color:'#3b82f6'},
  S11:  {label:'Aparcamiento',                   category:'informacion', icon:'🔵', color:'#3b82f6'},
  S13:  {label:'Paso de peatones (informativa)', category:'informacion', icon:'🔵', color:'#3b82f6'},
  H_PASO:   {label:'Paso de peatones (marca)',   category:'horizontal',  icon:'〰️', color:'#06b6d4'},
  H_CENTRO: {label:'Línea eje calzada',          category:'horizontal',  icon:'〰️', color:'#06b6d4'},
  H_STOP:   {label:'Línea de detención',         category:'horizontal',  icon:'〰️', color:'#06b6d4'},
  UNKNOWN:  {label:'Señal no identificada',      category:'desconocido', icon:'❓', color:'#8899bb'},
};

const COCO_TO_SIGN = {'stop sign':'R2','traffic light':'P2','parking meter':'S11'};
