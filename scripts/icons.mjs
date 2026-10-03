import { writeFile } from "node:fs/promises";
import { zlibSync } from "fflate";

// Raster versions of the hand-drawn pause symbol in public/icon.svg.
// Fill the background to the edges so Android and iOS can apply their own mask.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length);
  name.copy(result, 4);
  Buffer.from(bytes).copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, bytes])), result.length - 4);
  return result;
}
function insideBar(x, y, left) {
  if (x < left || x >= left + 26 || y < 48 || y >= 144) return false;
  const cx = Math.max(left + 4, Math.min(left + 22, x));
  const cy = Math.max(52, Math.min(140, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= 16;
}
function icon(size) {
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) * 192) / size;
      const py = ((y + 0.5) * 192) / size;
      const white = insideBar(px, py, 57) || insideBar(px, py, 109);
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      rows.set(white ? [255, 255, 255] : [238, 53, 59], offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const size of [192, 512, 180])
  await writeFile(
    size === 180 ? "public/apple-touch-icon.png" : `public/icon-${size}.png`,
    icon(size),
  );
