'use client';

// WM-03: Export toolbar for the ERD canvas.
//
// Uses html-to-image for rasterization/vectorization and jspdf for PDF wrapping.
// The target element is identified by the id "erd-canvas" which is set on the
// ReactFlow wrapper div in ERDCanvas.tsx.

import { toPng, toSvg } from 'html-to-image';
import { jsPDF }        from 'jspdf';

export default function ExportToolbar() {
  function getCanvas(): HTMLElement | null {
    return document.getElementById('erd-canvas');
  }

  async function exportPNG() {
    const el = getCanvas();
    if (!el) return;
    const dataUrl = await toPng(el, { quality: 0.95, pixelRatio: 2 });
    download(dataUrl, `schema-${timestamp()}.png`);
  }

  async function exportSVG() {
    const el = getCanvas();
    if (!el) return;
    const dataUrl = await toSvg(el);
    download(dataUrl, `schema-${timestamp()}.svg`);
  }

  async function exportPDF() {
    const el = getCanvas();
    if (!el) return;
    const dataUrl = await toPng(el, { pixelRatio: 2 });
    const pdf     = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a3' });
    const w       = pdf.internal.pageSize.getWidth();
    const h       = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    pdf.save(`schema-${timestamp()}.pdf`);
  }

  function download(dataUrl: string, filename: string) {
    const a    = document.createElement('a');
    a.download  = filename;
    a.href      = dataUrl;
    a.click();
  }

  function timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  }

  const btnClass =
    'px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 ' +
    'bg-white hover:bg-slate-50 text-slate-700 transition-colors';

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      <span className="text-xs font-semibold text-slate-400 mr-1">Export:</span>
      <button onClick={exportPNG} className={btnClass}>⬇ PNG</button>
      <button onClick={exportSVG} className={btnClass}>⬇ SVG</button>
      <button onClick={exportPDF} className={btnClass}>⬇ PDF</button>
    </div>
  );
}
