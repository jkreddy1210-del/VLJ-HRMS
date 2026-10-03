const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const input = path.join(__dirname, "../public/images/vlj-logo-source.png");
const output = path.join(__dirname, "../public/images/vlj-logo.png");

function isBackground(r, g, b) {
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);

  // Remove black / near-black (JPEG background + inner dark holes)
  if (brightness < 42) return true;
  if (max < 48 && brightness < 55) return true;

  return false;
}

async function main() {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isBackground(r, g, b)) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    }
  }

  const tmp = output + ".tmp.png";
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 5 })
    .png({ compressionLevel: 9 })
    .toFile(tmp);

  await sharp(tmp)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output);

  fs.unlinkSync(tmp);
  console.log("Transparent logo saved:", output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
