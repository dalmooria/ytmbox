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

// 트레이 템플릿 아이콘: 앱 아이콘의 레코드판을 단색 글리프로 옮긴 것.
//
// macOS 템플릿 이미지는 색을 무시하고 알파만 읽는다. 메뉴 막대의 밝기와 강조 상태에
// 맞춰 시스템이 알아서 칠하므로 검은색과 알파만 쓴다.
//
// 홈(groove)을 나타내는 동심원 띠를 넣어 봤지만 16px에서는 넣는 족족 레코드판이 아니라
// 과녁으로 보였다. 띠 폭을 0.32px까지 줄여도 옅은 회색 링으로 남아 형태만 흐렸다.
// 16px에서 살아남는 것은 가운데가 뚫린 단순한 원반뿐이라 그것만 남겼다.
const DISC = {
  outer: 0.92, // 반지름(짧은 변의 절반 기준). 메뉴 막대 여백을 남기려고 1.0을 다 쓰지 않는다.
  hole: 0.30, // 라벨 구멍. 이보다 작으면 16px에서 메워져 그냥 동그라미가 된다.
};

/** 레코드판 안쪽이면 true. 좌표는 이미지 중심을 원점으로 한 -1..1. */
function inDisc(nx, ny) {
  const r = Math.hypot(nx, ny);
  return r <= DISC.outer && r > DISC.hole;
}

// 가장자리 계단을 없애려고 픽셀마다 4x4로 과표본해 알파를 덮인 비율로 계산한다.
const SAMPLES = 4;

function trayIcon(size) {
  return png(size, (x, y) => {
    let hits = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const px = x + (sx + 0.5) / SAMPLES;
        const py = y + (sy + 0.5) / SAMPLES;
        if (inDisc((px / size) * 2 - 1, (py / size) * 2 - 1)) hits++;
      }
    }
    return [0, 0, 0, Math.round((hits / (SAMPLES * SAMPLES)) * 255)];
  });
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate.png'), trayIcon(16));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate@2x.png'), trayIcon(32));
console.log('icons written: assets/trayTemplate.png, assets/trayTemplate@2x.png');
