'use strict';
/* ══════════════════════════════════════════
   EXPORT.JS — Generación de archivos de exportación
   Formatos: CSV, JSON, KML, XLSX (básico), HTML
   ══════════════════════════════════════════ */
const Exporter = (() => {

  async function exportData(format, range = 'all') {
    const records = await _getRecords(range);
    if (records.length === 0) { Toast.show('No hay datos para exportar', 'warning'); return; }

    switch (format) {
      case 'csv':  return _downloadCSV(records);
      case 'json': return _downloadJSON(records);
      case 'kml':  return _downloadKML(records);
      case 'xlsx': return _downloadXLSX(records);
      case 'html': return _downloadHTML(records);
      default: Toast.show('Formato desconocido', 'error');
    }
  }

  async function _getRecords(range) {
    if (range === 'all') return DB.getAllEvaluations();
    const days = range === '7d' ? 7 : 30;
    return DB.getEvaluationsSince(Date.now() - days * 86400000);
  }

  /* ── CSV ── */
  function _downloadCSV(records) {
    const sep = APP_CONFIG.export.csvSeparator;
    const paramIds = PARAMS.map(p => p.id);
    const headers = [
      'ID', 'Fecha', 'Hora', 'Tipo señal', 'Categoría', 'Horizontal',
      'Estado', 'Rating IA', 'Rating Final', 'Confianza IA',
      ...paramIds.map(id => `${id} (AI)`),
      ...paramIds.map(id => `${id} (Usuario)`),
      'Latitud', 'Longitud', 'Precisión GPS',
    ];

    const rows = records.map(r => {
      const d = new Date(r.ts);
      return [
        r.id,
        d.toLocaleDateString('es-ES'),
        d.toLocaleTimeString('es-ES'),
        r.signType,
        r.category,
        r.isHorizontal ? 'Sí' : 'No',
        r.status,
        r.aiRating ?? '',
        r.finalRating ?? '',
        r.confidence ?? '',
        ...paramIds.map(id => r.aiValues?.[id] ?? ''),
        ...paramIds.map(id => r.userValues?.[id] ?? ''),
        r.lat ?? '', r.lng ?? '', r.accuracy ?? '',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep);
    });

    const csv = [headers.join(sep), ...rows].join('\n');
    _download('roadsign_export.csv', 'text/csv;charset=utf-8', '\uFEFF' + csv);
  }

  /* ── JSON ── */
  function _downloadJSON(records) {
    const json = JSON.stringify({ exportDate: new Date().toISOString(), version: APP_CONFIG.version, records }, null, 2);
    _download('roadsign_export.json', 'application/json', json);
  }

  /* ── KML ── */
  function _downloadKML(records) {
    const withGPS = records.filter(r => r.lat && r.lng);
    const placemarks = withGPS.map(r => {
      const info = SIGN_CATALOG[r.signType] || {};
      return `  <Placemark>
    <name>${r.signType} — ${info.label || 'Señal'}</name>
    <description>Rating: ${r.finalRating ?? r.aiRating} | Estado: ${r.status}</description>
    <Point><coordinates>${r.lng},${r.lat},0</coordinates></Point>
  </Placemark>`;
    }).join('\n');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>RoadSign Evaluator Export</name>
${placemarks}
</Document>
</kml>`;
    _download('roadsign_export.kml', 'application/vnd.google-earth.kml+xml', kml);
  }

  /* ── XLSX (CSV con extensión .xlsx para apertura directa en Excel) ── */
  function _downloadXLSX(records) {
    // Fallback CSV con extensión xlsx para compatibilidad sin librería
    _downloadCSV(records);
    Toast.show('Guardado como CSV compatible con Excel', 'warning');
  }

  /* ── HTML Report ── */
  function _downloadHTML(records) {
    const rows = records.map(r => {
      const d = new Date(r.ts);
      const info = SIGN_CATALOG[r.signType] || {};
      const rating = r.finalRating ?? r.aiRating ?? 0;
      return `<tr>
        <td>${r.id}</td>
        <td>${d.toLocaleDateString('es-ES')}</td>
        <td><strong>${r.signType}</strong><br><small>${info.label||''}</small></td>
        <td>${r.status}</td>
        <td style="color:${ratingColor(rating)};font-weight:700">${rating}</td>
        <td>${r.lat ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '—'}</td>
      </tr>`;
    }).join('');

    const avgRating = records.length
      ? Math.round(records.reduce((a, r) => a + (r.finalRating ?? r.aiRating ?? 0), 0) / records.length)
      : 0;

    const html = `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>RoadSign Report</title>
<style>
  body{font-family:sans-serif;background:#0a0e1a;color:#f0f4ff;margin:0;padding:24px}
  h1{color:#f5c518;font-size:28px;margin-bottom:4px}
  .meta{color:#8899bb;font-size:13px;margin-bottom:24px}
  .kpi-bar{display:flex;gap:16px;margin-bottom:24px}
  .kpi{background:#111827;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 24px;text-align:center}
  .kpi strong{display:block;font-size:32px;color:#f5c518}
  .kpi span{font-size:12px;color:#8899bb;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;background:#111827;border-radius:12px;overflow:hidden}
  th{background:#1a2235;padding:12px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8899bb}
  td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px}
  tr:last-child td{border-bottom:none}
</style></head><body>
<h1>🚦 RoadSign Evaluator</h1>
<div class="meta">Reporte generado el ${new Date().toLocaleString('es-ES')} · ${records.length} evaluaciones</div>
<div class="kpi-bar">
  <div class="kpi"><strong>${records.length}</strong><span>Total</span></div>
  <div class="kpi"><strong style="color:${ratingColor(avgRating)}">${avgRating}</strong><span>Rating medio</span></div>
  <div class="kpi"><strong>${records.filter(r=>r.status==='accepted'||r.status==='edited').length}</strong><span>Validadas</span></div>
  <div class="kpi"><strong>${records.filter(r=>r.status==='rejected').length}</strong><span>Rechazadas</span></div>
</div>
<table><thead><tr><th>ID</th><th>Fecha</th><th>Señal</th><th>Estado</th><th>Rating</th><th>GPS</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
    _download('roadsign_report.html', 'text/html;charset=utf-8', html);
  }

  /* ── Helpers ── */
  function _download(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    Toast.show(`Exportado: ${filename}`, 'success');
  }

  return { exportData };
})();
