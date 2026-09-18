// 플레이스홀더 아이콘 생성기. 외부 의존성 없음 (zlib만 사용).
// 나중에 디자인된 PNG로 덮어써도 된다.
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

function inCircle(x, y, cx, cy, r) {
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
}

// 앱 아이콘: 빨간 원 배경 + 흰 삼각형(재생) 느낌의 단순 도형
function appIcon(size) {
  return png(size, (x, y) => {
    const c = size / 2;
    if (!inCircle(x, y, c, c, size * 0.47)) return [0, 0, 0, 0];
    // 흰 삼각형: 좌변 x=0.38, 우끝 x=0.70, 세로 중심
    const nx = x / size, ny = y / size;
    const inTri = nx >= 0.38 && nx <= 0.70 && Math.abs(ny - 0.5) <= (0.70 - nx) * 0.62;
    return inTri ? [255, 255, 255, 255] : [255, 0, 0, 255];
  });
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
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), appIcon(1024));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate.png'), trayIcon(16));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate@2x.png'), trayIcon(32));
console.log('icons written: build/icon.png, assets/trayTemplate.png, assets/trayTemplate@2x.png');
