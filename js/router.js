// Enkel ruting med #/sti i adressen.
import { useState, useEffect } from './lib.js';
import { flushAll } from './ui.js';

export function go(sti, erstatt = false) {
  flushAll();
  const url = '#/' + sti;
  if (erstatt) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = url;
  }
}

export function parse(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const [sti, sporring = ''] = h.split('?');
  const deler = sti.split('/').filter(Boolean).map(decodeURIComponent);
  const q = Object.fromEntries(new URLSearchParams(sporring));
  return { deler, q, sti };
}

export function useRute() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => {
      flushAll();
      setH(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parse(h);
}
