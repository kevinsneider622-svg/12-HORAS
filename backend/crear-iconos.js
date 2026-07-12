const fs = require('fs');
const path = require('path');

function crearSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${Math.round(size*0.2)}" fill="#E8500A"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" 
          fill="white" font-size="${Math.round(size*0.28)}" 
          font-family="Arial" font-weight="bold">12H</text>
  </svg>`;
}

const frontendPath = path.join(__dirname, '../frontend');

fs.writeFileSync(path.join(frontendPath, 'icon-96.png'),  crearSVG(96));
fs.writeFileSync(path.join(frontendPath, 'icon-192.png'), crearSVG(192));
fs.writeFileSync(path.join(frontendPath, 'icon-512.png'), crearSVG(512));

console.log('✅ Íconos creados correctamente en /frontend');