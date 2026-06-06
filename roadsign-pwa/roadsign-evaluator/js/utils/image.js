// ============================================================
// RoadSign Evaluator — utils/image.js
// Procesamiento de imagen: rotación, crop, base64, análisis
// ============================================================

const ImageUtils = (() => {

  // ── Capturar frame de video → base64 (con corrección orientación) ──
  function captureFrame(videoEl, quality = 0.85) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');

    // Corrección de orientación
    const orType = screen.orientation?.type || 'portrait-primary';
    if (orType.includes('landscape')) {
      canvas.width  = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
    } else {
      // Portrait: el video ya viene correcto desde facingMode:environment en móvil
      canvas.width  = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // ── Redimensionar imagen para inferencia ─────────────────
  function resize(base64, targetW, targetH) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = targetW;
        canvas.height = targetH;
        canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas);
      };
      img.src = base64;
    });
  }

  // ── Crop de bounding box ─────────────────────────────────
  function cropBBox(base64, bbox, padding = 0.1) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const pw = bbox.width  * padding;
        const ph = bbox.height * padding;
        const x  = Math.max(0, bbox.x - pw);
        const y  = Math.max(0, bbox.y - ph);
        const w  = Math.min(img.width  - x, bbox.width  + pw * 2);
        const h  = Math.min(img.height - y, bbox.height + ph * 2);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.90));
      };
      img.src = base64;
    });
  }

  // ── Análisis heurístico de imagen para evaluación ────────
  // Extrae métricas visuales del crop de una señal
  function analyzeSignImage(base64) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const size   = 64; // Reducir para análisis rápido
        const canvas = document.createElement('canvas');
        canvas.width  = size;
        canvas.height = size;
        const ctx    = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let rSum=0, gSum=0, bSum=0, lumaSum=0, saturSum=0, edgeSum=0;
        const n = size * size;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          rSum += r; gSum += g; bSum += b;

          // Luminosidad
          const luma = 0.299*r + 0.587*g + 0.114*b;
          lumaSum += luma;

          // Saturación HSL
          const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
          const delta = max - min;
          saturSum += (max+min > 1) ? delta/(2 - max - min) : (max > 0 ? delta/max : 0);
        }

        // Detección de bordes simplificada (contraste local)
        let edgeCount = 0;
        for (let y = 1; y < size-1; y++) {
          for (let x = 1; x < size-1; x++) {
            const idx  = (y*size + x)*4;
            const idxR = (y*size + x+1)*4;
            const idxD = ((y+1)*size + x)*4;
            const luma = (data[idx]+data[idx+1]+data[idx+2])/3;
            const lumaR= (data[idxR]+data[idxR+1]+data[idxR+2])/3;
            const lumaD= (data[idxD]+data[idxD+1]+data[idxD+2])/3;
            const grad = Math.abs(luma-lumaR) + Math.abs(luma-lumaD);
            edgeSum += grad;
            if (grad > 30) edgeCount++;
          }
        }

        const avgLuma   = lumaSum / n;          // 0–255
        const avgSat    = saturSum / n;         // 0–1
        const avgEdge   = edgeSum / n;          // contraste local
        const edgeDensity = edgeCount / n;       // 0–1
        const avgR = rSum/n, avgG = gSum/n, avgB = bSum/n;

        // Detección de colores dominantes
        const isRedDom     = avgR > 140 && avgR > avgG*1.4 && avgR > avgB*1.4;
        const isYellowDom  = avgR > 150 && avgG > 130 && avgB < 80;
        const isBlueDom    = avgB > 120 && avgB > avgR*1.3 && avgB > avgG*1.2;
        const isGreenDom   = avgG > 120 && avgG > avgR*1.3 && avgG > avgB*1.2;
        const isDark       = avgLuma < 80;
        const isBright     = avgLuma > 180;

        resolve({
          avgLuma, avgSat, avgEdge, edgeDensity,
          avgR, avgG, avgB,
          isRedDom, isYellowDom, isBlueDom, isGreenDom,
          isDark, isBright,
          // Métricas derivadas para evaluación
          clarity:     clamp(edgeDensity * 5, 0, 1),   // claridad de bordes
          brightness:  clamp(avgLuma / 255, 0, 1),
          saturation:  clamp(avgSat, 0, 1),
          contrast:    clamp(avgEdge / 80, 0, 1),
        });
      };
      img.src = base64;
    });
  }

  // ── Calcular hash simple de imagen (para dedup) ──────────
  function quickHash(base64) {
    // Usa primeros 500 chars como fingerprint (rápido, no criptográfico)
    const s = base64.slice(0, 500);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16);
  }

  // ── Tamaño en bytes de base64 ─────────────────────────────
  function base64SizeKB(b64) {
    return Math.round(b64.length * 3 / 4 / 1024);
  }

  // ── Cargar File → base64 ─────────────────────────────────
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Orientar imagen desde File (EXIF) ────────────────────
  async function orientFile(file) {
    const b64 = await fileToBase64(file);
    // Retornamos la imagen tal cual — navegadores modernos ya respetan EXIF orientation
    return b64;
  }

  return {
    captureFrame, resize, cropBBox,
    analyzeSignImage, quickHash, base64SizeKB,
    fileToBase64, orientFile,
  };
})();

window.ImageUtils = ImageUtils;
