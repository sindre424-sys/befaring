// Laster eksportbibliotekene først når de trengs (de er store). Filene ligger lokalt og virker offline.
const lastet = {};

function skript(sti) {
  return (lastet[sti] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = sti;
    s.onload = () => resolve();
    s.onerror = () => {
      delete lastet[sti];
      reject(new Error('Kunne ikke laste ' + sti));
    };
    document.head.appendChild(s);
  }));
}

export async function lastXlsx() {
  await skript('vendor/xlsx.mini.min.js');
  return window.XLSX;
}
export async function lastDocx() {
  await skript('vendor/docx.umd.js');
  return window.docx;
}
export async function lastPdfmake() {
  await skript('vendor/pdfmake.min.js');
  await skript('vendor/vfs_fonts.js');
  return window.pdfMake;
}
export async function lastJszip() {
  await skript('vendor/jszip.min.js');
  return window.JSZip;
}
