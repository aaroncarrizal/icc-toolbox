export {};
const size = Number(process.argv[2]);

if (isNaN(size)) {
  console.error("Usage: npm run vw -- <px>   (e.g. npm run vw -- 24)");
  process.exit(1);
}

const BASE_WIDTH = 1920;

const vw = +((size / BASE_WIDTH) * 100).toFixed(4);

console.log(`${vw}vw`);
