// 트레이 플레이스홀더 아이콘 생성기. 외부 의존성 없음 (zlib만 사용).
// build/icon.png은 실제 아트워크라 여기서 생성하지 않는다 — 덮어쓰면 아트워크가 사라진다.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** pixel(x, y) => [r, g, b, a] */
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 트레이 템플릿: 검은 삼각형만 (macOS가 색을 알아서 반전)
function trayIcon(size) {
  return png(size, (x, y) => {
    const nx = x / size, ny = y / size;
    const inTri = nx >= 0.25 && nx <= 0.80 && Math.abs(ny - 0.5) <= (0.80 - nx) * 0.7;
    return inTri ? [0, 0, 0, 255] : [0, 0, 0, 0];
  });
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate.png'), trayIcon(16));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate@2x.png'), trayIcon(32));
console.log('icons written: assets/trayTemplate.png, assets/trayTemplate@2x.png');
