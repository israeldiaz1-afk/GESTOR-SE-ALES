'use strict';
/* ═══════════════════════════════════════════════════════════
   OBJECTDETECTOR.JS — Detector óptimo para móvil
   Estrategia:
   1. UNA sola lectura del frame a baja resolución (downscale)
   2. Clasificar cada píxel por color de señal (rojo/azul/amarillo)
   3. Agrupar píxeles contiguos del mismo color (connected components)
   4. Cada grupo compacto y suficientemente grande = candidato a señal
   Esto distingue señales (mancha compacta) de flores/telas (disperso)
   y es MUCHO más rápido que crear canvas temporales por celda.
   ═══════════════════════════════════════════════════════════ */
const ObjectDetector = (() => {
  let _ready = false;
  let _work = null; // canvas de trabajo reutilizable (downscale)

  const DOWNSCALE_W = 80; // resolución de análisis (rápida)
  const DOWNSCALE_H = 60;

  async function load(onProgress) {
    onProgress?.('Iniciando detector…', 60);
    await new Promise(r => setTimeout(r, 80));
    _ready = true;
    onProgress?.('Detector listo', 100);
  }

  function detect(sourceCanvas) {
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return [];
    const srcW = sourceCanvas.width, srcH = sourceCanvas.height;

    // 1. Downscale del frame a baja resolución para análisis rápido
    if (!_work) _work = document.createElement('canvas');
    _work.width = DOWNSCALE_W;
    _work.height = DOWNSCALE_H;
    const wctx = _work.getContext('2d', { willReadFrequently: true });
    try {
      wctx.drawImage(sourceCanvas, 0, 0, srcW, srcH, 0, 0, DOWNSCALE_W, DOWNSCALE_H);
    } catch(e) { return []; }

    let pixels;
    try {
      pixels = wctx.getImageData(0, 0, DOWNSCALE_W, DOWNSCALE_H).data;
    } catch(e) { return []; }

    // 2. Clasificar cada píxel por color de señal
    // labelMap: 0=nada, 1=rojo, 2=azul, 3=amarillo
    const N = DOWNSCALE_W * DOWNSCALE_H;
    const labelMap = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = pixels[i*4], g = pixels[i*4+1], b = pixels[i*4+2];
      labelMap[i] = _classifyPixel(r, g, b);
    }

    // 3. Connected components: agrupar píxeles contiguos del mismo color
    const components = _connectedComponents(labelMap, DOWNSCALE_W, DOWNSCALE_H);

    // 4. Filtrar componentes: tamaño + densidad (compacidad)
    const results = [];
    const scaleX = srcW / DOWNSCALE_W;
    const scaleY = srcH / DOWNSCALE_H;
    const minArea = 12; // mínimo de píxeles en baja resolución (~señal lejana)
    const maxArea = N * 0.6; // máximo (evitar fondos enormes)

    for (const comp of components) {
      if (comp.area < minArea || comp.area > maxArea) continue;

      const bw = comp.maxX - comp.minX + 1;
      const bh = comp.maxY - comp.minY + 1;
      const bboxArea = bw * bh;

      // Densidad: qué % del bounding box está relleno del color
      // Señal compacta: densidad alta (>0.45). Flores dispersas: densidad baja
      const density = comp.area / bboxArea;
      if (density < 0.45) continue;

      // Aspect ratio razonable para una señal (no líneas finas)
      const aspect = bw / bh;
      if (aspect < 0.35 || aspect > 3.0) continue;

      const color = comp.label === 1 ? 'red' : comp.label === 2 ? 'blue' : 'yellow';
      const cls   = comp.label === 1 ? 'stop sign' : comp.label === 2 ? 'blue sign' : 'warning sign';

      // Score: combina densidad y tamaño relativo
      const sizeScore = Math.min(comp.area / (N * 0.08), 1.0);
      const score = Math.min(0.45 + density * 0.35 + sizeScore * 0.15, 0.95);

      results.push({
        bbox: [
          Math.round(comp.minX * scaleX),
          Math.round(comp.minY * scaleY),
          Math.round(bw * scaleX),
          Math.round(bh * scaleY),
        ],
        score,
        class: cls,
        color,
        density,
      });
    }

    // Ordenar por score y limitar
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5);
  }

  // Clasifica un píxel: 0=nada, 1=rojo, 2=azul, 3=amarillo
  function _classifyPixel(r, g, b) {
    // Rojo de señal: rojo dominante y vivo
    if (r > 130 && g < 100 && b < 100 && (r - g) > 55 && (r - b) > 55) return 1;
    // Azul de señal: azul dominante
    if (b > 120 && r < 110 && g < 140 && (b - r) > 45 && (b - g) > 20) return 2;
    // Amarillo de señal: rojo+verde altos, azul bajo
    if (r > 150 && g > 130 && b < 100 && (r - b) > 70 && (g - b) > 50) return 3;
    return 0;
  }

  // Connected components con flood-fill iterativo (BFS)
  function _connectedComponents(labelMap, W, H) {
    const visited = new Uint8Array(W * H);
    const components = [];
    const stack = [];

    for (let start = 0; start < W * H; start++) {
      if (visited[start] || labelMap[start] === 0) continue;

      const label = labelMap[start];
      let area = 0, minX = W, maxX = 0, minY = H, maxY = 0;

      stack.length = 0;
      stack.push(start);
      visited[start] = 1;

      while (stack.length > 0) {
        const idx = stack.pop();
        const x = idx % W, y = (idx / W) | 0;
        area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;

        // 4-vecinos
        const neighbors = [
          x > 0     ? idx - 1 : -1,
          x < W - 1 ? idx + 1 : -1,
          y > 0     ? idx - W : -1,
          y < H - 1 ? idx + W : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && !visited[n] && labelMap[n] === label) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }

      components.push({ label, area, minX, maxX, minY, maxY });
    }

    return components;
  }

  function isReady() { return _ready; }
  return { load, detect, isReady };
})();
