/**
 * Draw the flat blue record, play button and mint musical note.
 * 用法：node scripts/gen-app-icon.js
 * 输出：static/app-icons/icon-{48,72,96,144,192,512}.png
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const OUT = path.join(__dirname, '..', 'static', 'app-icons')
const SIZES = [48, 72, 96, 144, 192, 512]
const SS = 3 // 超采样抗锯齿

let crcTable = null
function crc32(buf) {
  if (!crcTable) {
    crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function writePng(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const off = y * (width * 4 + 1)
    raw[off] = 0
    rgba.copy(raw, off + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  fs.writeFileSync(
    file,
    Buffer.concat([
      sig,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0))
    ])
  )
}

function render(size) {
  const W = size * SS
  const hi = Buffer.alloc(W * W * 4)
  const radius = W * 112 / 512

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      // 圆角矩形裁剪
      const nx = Math.max(radius, Math.min(W - radius, x))
      const ny = Math.max(radius, Math.min(W - radius, y))
      const dist = Math.hypot(x - nx, y - ny)
      if (dist > radius) continue

      const px = (x + 0.5) * 512 / W
      const py = (y + 0.5) * 512 / W
      const blue = [40, 85, 222]
      let color = blue
      const disc = Math.hypot(px - 239.5, py - 242.5)
      if (disc <= 151.5) color = [219, 230, 255]
      if (disc <= 131.5) color = blue
      if (disc <= 105.5) color = [25, 64, 182]

      const play = px >= 207 && px <= 300 && Math.abs(py - 242) <= (300 - px) * 60 / 93
      if (play) color = [255, 255, 255]

      const badge = Math.hypot(px - 361.5, py - 358.5)
      if (badge <= 79.5) color = blue
      if (badge <= 69.5) color = [137, 242, 209]
      const noteX = (px - 331) / 0.9
      const noteY = (py - 313) / 0.9
      const noteHead = ((noteX - 22.5) / 22.5) ** 2 + ((noteY - 79.5) / 14.5) ** 2 <= 1
      const noteStem = noteX >= 32 && noteX <= 45 && noteY >= 0 && noteY <= 79
      const flagTop = (noteX - 40) * 20 / 36
      const flagBottom = 17 + (noteX - 40) * 19 / 36
      const noteFlag = noteX >= 40 && noteX <= 76 && noteY >= flagTop && noteY <= flagBottom
      if (noteHead || noteStem || noteFlag) color = [21, 55, 94]
      const i = (y * W + x) * 4
      hi[i] = color[0]; hi[i + 1] = color[1]; hi[i + 2] = color[2]; hi[i + 3] = 255
    }
  }

  // 降采样
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, rr = 0, gg = 0, bb = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4
          const alpha = hi[i + 3]
          if (!alpha) continue
          a += alpha
          rr += hi[i] * alpha
          gg += hi[i + 1] * alpha
          bb += hi[i + 2] * alpha
        }
      }
      const o = (y * size + x) * 4
      if (!a) continue
      out[o] = Math.round(rr / a)
      out[o + 1] = Math.round(gg / a)
      out[o + 2] = Math.round(bb / a)
      out[o + 3] = Math.round(a / (SS * SS))
    }
  }
  return out
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })
for (const size of SIZES) {
  const file = path.join(OUT, `icon-${size}.png`)
  writePng(file, size, size, render(size))
  console.log('[gen-app-icon]', file, fs.statSync(file).size, 'bytes')
}
