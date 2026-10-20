export {};
const size = Number(process.argv[2]);

if (isNaN(size)) {
  console.error("Usage: npm run vh -- <px>   (e.g. npm run vh -- 24)");
  process.exit(1);
}

const BASE_HEIGHT = 1080;

const vh = +((size / BASE_HEIGHT) * 100).toFixed(4);

console.log(`${vh}vh`);
