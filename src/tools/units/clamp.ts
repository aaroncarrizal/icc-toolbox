export {};
const size = Number(process.argv[2]);

if (isNaN(size)) {
  console.error("Uso: npm run clamp -- <tamaño>");
  process.exit(1);
}

const BASE_WIDTH = 1920;
const MIN_FACTOR = 0.9;

const min = +(size * MIN_FACTOR).toFixed(2);
const vw = +((size / BASE_WIDTH) * 100).toFixed(4);

console.log(`clamp(${min}px, ${vw}vw, ${size}px)`);
