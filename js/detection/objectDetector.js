'use strict';
const ObjectDetector = (() => {
  let _ready = false;

  async function load(onProgress) {
    onProgress?.('Iniciando detector…', 60);
    await new Promise(r => setTimeout(r, 100));
    _ready = true;
    onProgress?.('Detector listo', 100);
  }

  // Detecta regiones candidatas en el canvas
  // Estrategia: escanear a múltiples escalas buscando regiones con
  // color de señal DOMINANTE y COMPACTO (no disperso como flores)
  function detect(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return [];
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const results = [];

    // Escala 1: cuadrícula 4x4 (regiones grandes)
    const cols = 4, rows = 4;
    const cW = Math.floor(W / cols);
    const cH = Math.floor(H / rows);
    if (cW >= 40 && cH >= 40) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cW, y = r * cH;
          const w = c === cols-1 ? W - x : cW;
          const h = r === rows-1 ? H - y : cH;
          const a = _analyzeRegion(ctx, x, y, w, h);
          if (a.isSignCandidate) results.push({ bbox:[x,y,w,h], score:a.score, class:a.class, color:a.color });
        }
      }
    }

    // Escala 2: cuadrícula 6x6 más fina (regiones pequeñas/lejanas)
    const cols2 = 6, rows2 = 6;
    const cW2 = Math.floor(W / cols2);
    const cH2 = Math.floor(H / rows2);
    if (cW2 >= 40 && cH2 >= 40) {
      for (let r = 0; r < rows2; r++) {
        for (let c = 0; c < cols2; c++) {
          const x = c * cW2, y = r * cH2;
          const w = c === cols2-1 ? W - x : cW2;
          const h = r === rows2-1 ? H - y : cH2;
          // Evitar duplicar regiones ya cubiertas en escala 1
          if (w < 40 || h < 40) continue;
          const a = _analyzeRegion(ctx, x, y, w, h);
          if (a.isSignCandidate) results.push({ bbox:[x,y,w,h], score:a.score*0.9, class:a.class, color:a.color });
        }
      }
    }

    return _nms(results, 0.25);
  }

  function _analyzeRegion(ctx, x, y, w, h) {
    try {
      // Muestrear a baja resolución (16x16) para velocidad
      const SAMPLE = 16;
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = SAMPLE; tmpCanvas.height = SAMPLE;
      tmpCanvas.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, SAMPLE, SAMPLE);
      const data = tmpCanvas.getContext('2d').getImageData(0, 0, SAMPLE, SAMPLE).data;

      let rC=0, bC=0, yC=0, tot=0;
      // Mapa 16x16 de qué píxeles son del color objetivo
      const redMap = [], blueMap = [], yellowMap = [];

      for (let i = 0; i < data.length; i += 4) {
        const r=data[i], g=data[i+1], b=data[i+2];
        tot++;
        const isRed    = r>160 && g<90 && b<90 && (r-g)>80 && (r-b)>80;
        const isBlue   = b>160 && r<100 && g<130 && (b-r)>70;
        const isYellow = r>170 && g>150 && b<80 && (r-b)>100 && (g-b)>80;
        redMap.push(isRed);
        blueMap.push(isBlue);
        yellowMap.push(isYellow);
        if (isRed)    rC++;
        if (isBlue)   bC++;
        if (isYellow) yC++;
      }

      if (!tot) return { isSignCandidate: false };
      const rR = rC/tot, bR = bC/tot, yR = yC/tot;

      // CLAVE: verificar que los píxeles de color son COMPACTOS (contiguos)
      // no dispersos como flores. Calculamos la varianza posicional.
      let bestColor = null, bestScore = 0, bestClass = '';
      if (rR > 0.20) { bestColor='red';    bestScore=rR; bestClass='stop sign'; }
      if (bR > 0.20 && bR > bestScore) { bestColor='blue';   bestScore=bR; bestClass='blue sign'; }
      if (yR > 0.18 && yR > bestScore) { bestColor='yellow'; bestScore=yR; bestClass='warning sign'; }

      if (!bestColor) return { isSignCandidate: false };

      // Verificar compacidad: los píxeles del color deben estar concentrados
      const colorMap = bestColor==='red' ? redMap : bestColor==='blue' ? blueMap : yellowMap;
      const compactScore = _computeCompactness(colorMap, SAMPLE, SAMPLE);

      // Score bajo de compacidad = píxeles dispersos = flores/tela/fondo
      // Score alto = región concentrada = señal real
      if (compactScore < 0.35) return { isSignCandidate: false };

      // Umbral final combinado: ratio de color * compacidad
      const finalScore = Math.min(bestScore * compactScore * 2.5, 0.95);
      if (finalScore < 0.40) return { isSignCandidate: false };

      return { isSignCandidate: true, score: finalScore, class: bestClass, color: bestColor };
    } catch(e) {
      return { isSignCandidate: false };
    }
  }

  // Mide cuán concentrados están los píxeles activos en el mapa
  // Usa la relación entre el bounding box interno y el área total
  function _computeCompactness(map, W, H) {
    let minX=W, maxX=0, minY=H, maxY=0, count=0;
    for (let i = 0; i < map.length; i++) {
      if (map[i]) {
        const x = i % W, y = Math.floor(i / W);
        if (x < minX) minX=x; if (x > maxX) maxX=x;
        if (y < minY) minY=y; if (y > maxY) maxY=y;
        count++;
      }
    }
    if (count < 4) return 0; // muy pocos píxeles
    const bboxArea = (maxX-minX+1) * (maxY-minY+1);
    const density  = count / bboxArea; // qué % del bbox interno está relleno
    const coverage = count / (W*H);    // qué % del total son del color
    // Señal real: bbox interno compacto (density > 0.4) Y cobertura significativa
    return density * Math.min(coverage * 5, 1.0);
  }

  function _nms(dets, threshold) {
    const sorted = [...dets].sort((a,b) => b.score-a.score);
    const kept = [];
    for (const d of sorted) {
      if (!kept.some(k => _iou(d.bbox, k.bbox) > threshold)) kept.push(d);
    }
    return kept.slice(0, 5);
  }

  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]) {
    const ix = Math.max(0, Math.min(ax+aw,bx+bw)-Math.max(ax,bx));
    const iy = Math.max(0, Math.min(ay+ah,by+bh)-Math.max(ay,by));
    const i=ix*iy, u=aw*ah+bw*bh-i;
    return u>0?i/u:0;
  }

  function isReady() { return _ready; }
  return { load, detect, isReady };
})();
