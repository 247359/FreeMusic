/**
 * 将应用的 SVG 图标转成三种固定颜色变体。
 * uni-app 的 <image> 不能给 SVG 染色，所以预先生成黑/白/主色三套。
 *
 * 用法（在 HBuilderX 项目根目录）：
 *   node scripts/gen-icons.js
 *
 * 源文件：scripts/source-icons/*.svg
 * 输出：scripts/generated-icons/ 下的中间 SVG
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, 'source-icons')
const OUT = path.join(__dirname, 'generated-icons')

const VARIANTS = {
  blk: '#000000',
  wht: '#ffffff',
  pri: '#335eea'
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg'))
let count = 0

for (const file of files) {
  const name = file.replace(/\.svg$/, '')
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8')
  for (const [suffix, color] of Object.entries(VARIANTS)) {
    const content = raw.replace(/currentColor/g, color)
    fs.writeFileSync(path.join(OUT, `${name}-${suffix}.svg`), content, 'utf8')
    count++
  }
}

console.log(`[gen-icons] ${files.length} icons -> ${count} svg files in ${OUT}`)
