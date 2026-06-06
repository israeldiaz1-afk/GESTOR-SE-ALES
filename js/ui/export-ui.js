'use strict';
/* ══════════════════════════════════
   EXPORT-UI.JS — Modal de exportación
   ══════════════════════════════════ */
const ExportUI = (() => {
  function show() {
    document.getElementById('modal-export').style.display = 'flex';
  }
  function hide() {
    document.getElementById('modal-export').style.display = 'none';
  }
  async function doExport() {
    const format = document.getElementById('modal-export-format').value;
    const range  = document.getElementById('modal-export-range').value;
    hide();
    await Exporter.exportData(format, range);
  }
  return { show, hide, doExport };
})();
