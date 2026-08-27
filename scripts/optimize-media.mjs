import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets", "media");
const brandDir = path.join(root, "assets");
const outMedia = path.join(root, "public", "media");
const outBrand = path.join(root, "public", "brand");
const outIcons = path.join(root, "src", "app");

const images = [
  ["hero-boats", "WhatsApp Image 2026-08-18 at 11.37.29 PM (1).jpeg"],
  ["cottages", "WhatsApp Image 2026-08-18 at 11.37.28 PM (1).jpeg"],
  ["camp-umbrellas", "WhatsApp Image 2026-08-18 at 11.37.26 PM (1).jpeg"],
  ["water-sun", "WhatsApp Image 2026-08-18 at 11.37.28 PM (2).jpeg"],
  ["camp-gazebos", "WhatsApp Image 2026-08-18 at 11.37.30 PM.jpeg"],
  ["one-bed-01", "WhatsApp Image 2026-08-18 at 11.37.27 PM.jpeg"],
  ["one-bed-02", "WhatsApp Image 2026-08-18 at 11.37.29 PM.jpeg"],
  ["one-bed-03", "WhatsApp Image 2026-08-18 at 11.37.30 PM (2).jpeg"],
  ["one-bed-04", "WhatsApp Image 2026-08-18 at 11.38.19 PM.jpeg"],
  ["two-bed-01", "WhatsApp Image 2026-08-18 at 11.37.30 PM (1).jpeg"],
  ["two-bed-02", "WhatsApp Image 2026-08-18 at 11.39.06 PM.jpeg"],
  ["two-bed-03", "WhatsApp Image 2026-08-26 at 5.40.59 PM.jpeg"],
  ["bathroom", "WhatsApp Image 2026-08-18 at 11.37.28 PM.jpeg"],
  ["night-lanterns", "WhatsApp Image 2026-08-26 at 5.40.56 PM (1).jpeg"],
  ["night-pavilion", "WhatsApp Image 2026-08-26 at 5.40.58 PM (2).jpeg"],
  ["food-thali", "WhatsApp Image 2026-08-26 at 5.40.55 PM (2).jpeg"],
  ["food-breakfast", "WhatsApp Image 2026-08-26 at 5.40.57 PM.jpeg"],
  ["food-grill-plate", "WhatsApp Image 2026-08-26 at 5.40.56 PM (2).jpeg"],
  ["food-grill-fire", "WhatsApp Image 2026-08-26 at 5.40.56 PM.jpeg"],
];

await fs.mkdir(outMedia, { recursive: true });
await fs.mkdir(outBrand, { recursive: true });

for (const [id, filename] of images) {
  const source = path.join(sourceDir, filename);
  const image = sharp(source).rotate();
  const meta = await image.metadata();
  const width = Math.min(meta.width ?? 1600, 1600);
  await image
    .clone()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(outMedia, `${id}.jpg`));
  await image
    .clone()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(outMedia, `${id}.webp`));
  console.log(`media ${id}`);
}

const logos = [
  ["emblem.png", "logo 1.png"],
  ["lockup.png", "logo 2.png"],
  ["lockup-bg.png", "logo with bg.png"],
];

for (const [outName, sourceName] of logos) {
  const source = path.join(brandDir, sourceName);
  await fs.copyFile(source, path.join(outBrand, outName));
  await sharp(source)
    .resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(path.join(outBrand, outName.replace(".png", ".webp")));
  console.log(`brand ${outName}`);
}

const emblem = sharp(path.join(brandDir, "logo 1.png"));
await emblem
  .clone()
  .resize(32, 32)
  .png()
  .toFile(path.join(outIcons, "favicon.ico"));
await emblem
  .clone()
  .resize(180, 180)
  .png()
  .toFile(path.join(outBrand, "apple-touch.png"));

console.log("done");
