'use strict';
const Exporter = (() => {
  async function exportData(format, range='all') {
    const records = await _getRecords(range);
    if(!records.length){Toast.show('No hay datos para exportar','warning');return;}
    if(format==='csv') return _csv(records);
    if(format==='json') return _json(records);
    if(format==='kml')  return _kml(records);
    _html(records);
  }
  async function _getRecords(range){
    if(range==='all') return DB.getAllEvaluations();
    const days=range==='7d'?7:30;
    return DB.getEvaluationsSince(Date.now()-days*86400000);
  }
  function _csv(records){
    const sep=';';
    const paramIds=PARAMS.map(p=>p.id);
    const headers=['ID','Fecha','Tipo','Categoría','Estado','Rating AI','Rating Final','Confianza',...paramIds.map(id=>`${id}(AI)`),...paramIds.map(id=>`${id}(U)`),'Lat','Lng'];
    const rows=records.map(r=>{
      const d=new Date(r.ts);
      return [r.id,d.toLocaleDateString('es-ES'),r.signType,r.category,r.status,r.aiRating??'',r.finalRating??'',r.confidence??'',
        ...paramIds.map(id=>r.aiValues?.[id]??''),...paramIds.map(id=>r.userValues?.[id]??''),r.lat??'',r.lng??'']
        .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(sep);
    });
    _dl('roadsign_export.csv','text/csv','\uFEFF'+[headers.join(sep),...rows].join('\n'));
  }
  function _json(records){_dl('roadsign_export.json','application/json',JSON.stringify({version:'1.1',records},null,2));}
  function _kml(records){
    const pm=records.filter(r=>r.lat&&r.lng).map(r=>{
      const info=SIGN_CATALOG[r.signType]||{};
      return `  <Placemark><name>${r.signType} — ${info.label||'Señal'}</name>
    <description>Rating: ${r.finalRating??r.aiRating} | ${r.status}</description>
    <Point><coordinates>${r.lng},${r.lat},0</coordinates></Point></Placemark>`;
    }).join('\n');
    _dl('roadsign_export.kml','application/vnd.google-earth.kml+xml',
      `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>RoadSign</name>\n${pm}\n</Document></kml>`);
  }
  function _html(records){
    const rows=records.map(r=>{
      const info=SIGN_CATALOG[r.signType]||{};const rating=r.finalRating??r.aiRating??0;const d=new Date(r.ts);
      return `<tr><td>${r.id}</td><td>${d.toLocaleDateString('es-ES')}</td><td><strong>${r.signType}</strong><br><small>${info.label||''}</small></td><td>${r.status}</td><td style="color:${ratingColor(rating)};font-weight:700">${rating}</td><td>${r.lat?`${r.lat.toFixed(5)},${r.lng.toFixed(5)}`:'—'}</td></tr>`;
    }).join('');
    const avg=records.length?Math.round(records.reduce((a,r)=>a+(r.finalRating??r.aiRating??0),0)/records.length):0;
    _dl('roadsign_report.html','text/html',`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>RoadSign Report</title>
<style>body{font-family:sans-serif;background:#0a0e1a;color:#f0f4ff;padding:24px}h1{color:#f5c518}table{width:100%;border-collapse:collapse;background:#111827}th{background:#1a2235;padding:10px;font-size:12px;color:#8899bb}td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.05)}</style></head>
<body><h1>RoadSign Report</h1><p>${records.length} evaluaciones · Rating medio: <strong style="color:${ratingColor(avg)}">${avg}</strong></p>
<table><thead><tr><th>ID</th><th>Fecha</th><th>Señal</th><th>Estado</th><th>Rating</th><th>GPS</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  }
  function _dl(name,mime,content){
    const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
    Toast.show(`Exportado: ${name}`,'success');
  }
  return {exportData};
})();
