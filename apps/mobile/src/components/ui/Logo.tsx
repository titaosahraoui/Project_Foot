import { SvgXml } from "react-native-svg";

const GRADIENT_MARK = `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fcGrad" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00E676"/><stop offset="1" stop-color="#1DE9B6"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="24" fill="url(#fcGrad)"/>
  <g stroke="#04130B" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="48" cy="48" r="29" fill="none"/>
    <path d="M48 36 L59.4 44.3 L55 57.7 L41 57.7 L36.6 44.3 Z" fill="#04130B"/>
    <line x1="48" y1="36" x2="48" y2="19"/><line x1="59.4" y1="44.3" x2="76" y2="38.7"/>
    <line x1="55" y1="57.7" x2="65.6" y2="72"/><line x1="41" y1="57.7" x2="30.4" y2="72"/>
    <line x1="36.6" y1="44.3" x2="20" y2="38.7"/>
  </g>
</svg>`;

const MONO_MARK = `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#00E676" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="48" cy="48" r="29" fill="none"/>
    <path d="M48 36 L59.4 44.3 L55 57.7 L41 57.7 L36.6 44.3 Z" fill="#00E676"/>
    <line x1="48" y1="36" x2="48" y2="19"/><line x1="59.4" y1="44.3" x2="76" y2="38.7"/>
    <line x1="55" y1="57.7" x2="65.6" y2="72"/><line x1="41" y1="57.7" x2="30.4" y2="72"/>
    <line x1="36.6" y1="44.3" x2="20" y2="38.7"/>
  </g>
</svg>`;

export function Logo({ size = 64, mono = false }: { size?: number; mono?: boolean }) {
  return <SvgXml xml={mono ? MONO_MARK : GRADIENT_MARK} width={size} height={size} />;
}
