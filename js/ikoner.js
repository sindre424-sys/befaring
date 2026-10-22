// Ikoner for objekttyper (tegnet som SVG). Egne typer kan bruke en emoji i stedet.
import { html } from './lib.js';

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

export const IKONER = {
  tunnel: html`<path d="M4 41 H44" ...${S} /><path d="M11 41 V24 A13 13 0 0 1 37 24 V41" ...${S} /><path d="M17 41 V26 A7 7 0 0 1 31 26 V41" ...${S} stroke-width="2" opacity=".55" />`,
  skjaering: html`<path d="M3 13 H11 L16 37 H32 L37 13 H45" ...${S} /><path d="M19 37 H29" ...${S} stroke-width="2" stroke-dasharray="2 3" /><path d="M11 13 L13 22" ...${S} stroke-width="2" opacity=".55" /><path d="M37 13 L35 22" ...${S} stroke-width="2" opacity=".55" />`,
  pahugg: html`<path d="M3 41 H45" ...${S} /><path d="M3 30 Q13 9 27 9 Q39 10 45 22" ...${S} /><path d="M17 41 V33 A7 7 0 0 1 31 33 V41" ...${S} /><path d="M14 28 H34" ...${S} stroke-width="2" opacity=".55" />`,
  byggegrop: html`<path d="M3 14 H12 V38 H36 V14 H45" ...${S} /><path d="M12 22 H36" ...${S} stroke-width="2" opacity=".55" />`,
  generisk: html`<circle cx="24" cy="24" r="15" ...${S} />`,
};

export const IKON_VALG = Object.keys(IKONER);

export function TypeIkon({ ikon, size = 28 }) {
  const p = IKONER[ikon];
  if (p) {
    return html`<svg class="ikon" viewBox="0 0 48 48" width=${size} height=${size} aria-hidden="true">${p}</svg>`;
  }
  return html`<span class="ikon ikon-emoji" style=${`font-size:${Math.round(size * 0.8)}px;width:${size}px;height:${size}px`} aria-hidden="true">${ikon || '◆'}</span>`;
}
