// Deling via iOS-delingsarket (Mail, Filer, OneDrive …). På PC lastes filen ned i stedet.
export function kanDele(filer) {
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: filer }));
  } catch (e) {
    return false;
  }
}

/** Må kalles direkte fra et trykk (iPhone krever det). Returnerer true hvis delingen ble fullført. */
export async function delFiler(filer, tittel) {
  if (kanDele(filer)) {
    try {
      await navigator.share({ files: filer, title: tittel });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // brukeren avbrøt
      throw e;
    }
  }
  for (const f of filer) lastNed(f);
  return true;
}

export function lastNed(fil) {
  const url = URL.createObjectURL(fil);
  const a = document.createElement('a');
  a.href = url;
  a.download = fil.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const fmtStorrelse = (b) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
