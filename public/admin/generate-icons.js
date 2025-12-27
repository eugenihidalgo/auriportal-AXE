// Script para generar iconos PNG desde SVG
// Ejecutar con: node public/admin/generate-icons.js

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Por ahora, crear iconos SVG simples que funcionen como PNG
// En producción, se pueden convertir usando ImageMagick o Sharp

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="grad192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="192" height="192" fill="url(#grad192)" rx="30"/>
  <text x="96" y="120" font-size="100" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">✨</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#grad512)" rx="80"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">✨</text>
  <text x="256" y="420" font-size="60" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">Admin</text>
</svg>`;

// Guardar como SVG (los navegadores modernos los aceptan como iconos)
writeFileSync(join(projectRoot, 'public', 'admin', 'icon-192.png'), svg192);
writeFileSync(join(projectRoot, 'public', 'admin', 'icon-512.png', svg512));

console.log('✅ Iconos SVG generados (funcionan como PNG en navegadores modernos)');
console.log('💡 Para iconos PNG reales, instala ImageMagick y ejecuta:');
console.log('   convert public/admin/icon.svg -resize 192x192 public/admin/icon-192.png');
console.log('   convert public/admin/icon.svg -resize 512x512 public/admin/icon-512.png');

































