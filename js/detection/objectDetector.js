'use strict';
const ObjectDetector = (() => {
  let _ready = false;

  async function load(onProgress) {
    onProgress?.('Iniciando detector visual…', 50);
    await new Promise(r => setTimeout(r, 200));
    _ready = true;
    onProgress?.('Detector listo', 100);
  }

  // BUG1 FIX: grid no solapado + umbrales más estrictos para eliminar falsos positivos
  function detect(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return [];
    const results = [];
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');

    // Dividir canvas en zonas sin solapamiento: 4 cols × 4 rows = 16 celdas
    const cols = 4, rows = 4;
    const cellW = Math.floor(W / cols);
    const cellH = Math.floor(H / rows);

    if (cellW < 40 || cellH < 40) return []; // canvas demasiado pequeño

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellW;
        const y = row * cellH;
        const w = (col === cols - 1) ? W - x : cellW; // última celda cubre el resto
        const h = (row === rows - 1) ? H - y : cellH;

        const a = _analyzeRegion(ctx, x, y, w, h);
        if (a.isSignCandidate) {
          results.push({ bbox: [x, y, w, h], score: a.score, class: a.class, color: a.color });
        }
      }
    }

    return _nms(results, 0.3);
  }

  // BUG1 FIX: umbrales más altos y condiciones más estrictas
  function _analyzeRegion(ctx, x, y, w, h) {
    try {
      const data = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
      let rC=0, bC=0, yC=0, tot=0, rS=0, gS=0, bS=0;

      // Muestrear cada 3 píxeles para rendimiento
      for (let i = 0; i < data.length; i += 12) {
        const r=data[i], g=data[i+1], b=data[i+2];
        rS+=r; gS+=g; bS+=b; tot++;
        // Rojo puro (señales de prohibición/prioridad): rojo dominante, verde y azul bajos
        if (r > 160 && g < 80 && b < 80) rC++;
        // Azul puro (señales de obligación): azul dominante
        if (b > 160 && r < 100 && g < 120) bC++;
        // Amarillo (señales de peligro): rojo+verde altos, azul bajo
        if (r > 180 && g > 160 && b < 60) yC++;
      }

      if (!tot) return { isSignCandidate: false };

      const rR = rC/tot, bR = bC/tot, yR = yC/tot;
      const maxC = Math.max(rS/tot, gS/tot, bS/tot);
      const minC = Math.min(rS/tot, gS/tot, bS/tot);
      const sat = maxC > 10 ? (maxC - minC) / maxC : 0;

      // Umbrales más estrictos: al menos 25% de píxeles del color + saturación alta
      if (rR > 0.25 && sat > 0.45) {
        return { isSignCandidate:true, score:Math.min(0.5+rR,0.92), class:'stop sign', color:'red' };
      }
      if (bR > 0.25 && sat > 0.40) {
        return { isSignCandidate:true, score:Math.min(0.5+bR,0.92), class:'blue sign', color:'blue' };
      }
      if (yR > 0.22 && sat > 0.40) {
        return { isSignCandidate:true, score:Math.min(0.5+yR,0.92), class:'warning sign', color:'yellow' };
      }

      return { isSignCandidate: false };
    } catch (e) {
      return { isSignCandidate: false };
    }
  }

  function _nms(dets, threshold) {
    const sorted = [...dets].sort((a,b) => b.score - a.score);
    const kept = [];
    for (const d of sorted) {
      const overlap = kept.some(k => _iou(d.bbox, k.bbox) > threshold);
      if (!overlap) kept.push(d);
    }
    return kept.slice(0, 4); // máx 4 detecciones por frame
  }

  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]) {
    const ix = Math.max(0, Math.min(ax+aw,bx+bw) - Math.max(ax,bx));
    const iy = Math.max(0, Math.min(ay+ah,by+bh) - Math.max(ay,by));
    const inter = ix*iy;
    const union = aw*ah + bw*bh - inter;
    return union > 0 ? inter/union : 0;
  }

  function isReady() { return _ready; }
  return { load, detect, isReady };
})();
