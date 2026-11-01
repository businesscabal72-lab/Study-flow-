// Regenerates PNG app icons from the SVG mark: `npm run icons`
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url));
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname;
// Maskable: full-bleed background with the mark inside the 80% safe zone.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#557a5c"/><g transform="translate(4 4)">${svg
    .toString()
    .replace(/<svg[^>]*>|<\/svg>/g, "")
    .replace(/<rect[^>]*\/>/, "")}</g></svg>`
);

await sharp(svg, { density: 512 }).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg, { density: 1024 }).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg, { density: 512 }).resize(180, 180).flatten({ background: "#557a5c" }).png().toFile(out("apple-touch-icon.png"));
await sharp(maskable, { density: 1024 }).resize(512, 512).png().toFile(out("maskable-512.png"));
await sharp(svg, { density: 256 }).resize(32, 32).png().toFile(out("favicon-32.png"));
console.log("icons generated");
