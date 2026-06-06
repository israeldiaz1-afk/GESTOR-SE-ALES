'use strict';
/* ══════════════════════════════════════════════
   MARKINGDETECTOR.JS — Detección de marcas horizontales
   Analiza regiones de calzada buscando líneas/pasos
   usando análisis de canvas (sin modelo externo)
   ══════════════════════════════════════════════ */
const MarkingDetector = (() => {

  // Analiza franja inferior de la imagen buscando marcas viales blancas
  function detect(canvas) {
    const results = [];
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    // Analizar los dos tercios inferiores (donde está la calzada)
    const startY = Math.round(h * 0.35);
    const regionH = h - startY;

    // Dividir en 3 columnas horizontales para buscar franjas
    const cols = 4;
    const colW = Math.round(w / cols);

    const stripes = [];
    for (let c=0; c<cols; c++) {
      const rx = c * colW;
      const density = _whiteLineDensity(ctx, rx, startY, colW, regionH);
      stripes.push({ col: c, density, x: rx, y: startY, w: colW, h: regionH });
    }

    // Paso de peatones: múltiples columnas con alta densidad blanca alternada
    const highDensityCols = stripes.filter(s => s.density > 0.3);
    if (highDensityCols.length >= 2) {
      // Bbox abarcando toda la franja horizontal
      const minX = Math.min(...highDensityCols.map(s => s.x));
      const maxX = Math.max(...highDensityCols.map(s => s.x + s.w));
      results.push({
        signType: 'H_PASO',
        category: 'horizontal',
        bbox: [minX, startY + regionH*0.3, maxX - minX, regionH * 0.5],
        confidence: 0.55 + (highDensityCols.length / cols) * 0.2,
        isHorizontal: true,
      });
    }

    // Línea continua: franja central con alta densidad
    const centerStripe = stripes[Math.floor(cols/2)];
    if (centerStripe && centerStripe.density > 0.5 && highDensityCols.length === 1) {
      results.push({
        signType: 'H_CENTRO',
        category: 'horizontal',
        bbox: [centerStripe.x, startY, centerStripe.w, regionH],
        confidence: 0.50,
        isHorizontal: true,
      });
    }

    return results;
  }

  // Calcula densidad de píxeles blancos/amarillos en una región
  function _whiteLineDensity(ctx, x, y, w, h) {
    try {
      const data = ctx.getImageData(
        Math.max(0, x), Math.max(0, y),
        Math.min(w, ctx.canvas.width - x),
        Math.min(h, ctx.canvas.height - y)
      ).data;
      let white = 0, total = data.length / 4;
      for (let i=0; i<data.length; i+=4) {
        const r=data[i], g=data[i+1], b=data[i+2];
        // Blanco o amarillo brillante
        if ((r>200 && g>200 && b>200) || (r>200 && g>180 && b<80)) white++;
      }
      return white / total;
    } catch { return 0; }
  }

  return { detect };
})();
