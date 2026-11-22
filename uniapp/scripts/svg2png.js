/**
 * 把 scripts/generated-icons/*.svg 批量转成 PNG，解决 DCloud Vapor SDK 对 SVG 的
 * "Unrecognized image class" 兼容性问题（uni-app x <image> 加载 SVG 会无限报错且不显示）。
 *
 * 依赖：@resvg/resvg-js（开发期本地安装，不进入 App 产物）
 *   npm install --no-save @resvg/resvg-js
 * 用法：node scripts/svg2png.js
 *
 * 输出：static/icons/<name>.png（96x96 透明底，图标等比居中）
 * AppIcon.uvue 引用路径由 .svg 改为 .png。
 */
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const DIR = path.join(__dirname, 'generated-icons')
const OUT = path.join(__dirname, '..', 'static', 'icons')
fs.mkdirSync(OUT, { recursive: true })
const SIZE = 96

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'))
let count = 0
for (const file of files) {
  let svg = fs.readFileSync(path.join(DIR, file), 'utf8')
  // 有些源文件最外层是 <span><svg>...</svg></span>，取出真正的 svg 节点
  const inner = svg.match(/<svg[\s\S]*?<\/svg>/)
  if (inner) svg = inner[0]
  // 强制在根 svg 上补 width/height，让 resvg 按 96x96 fitTo 渲染、等比居中
  const fitted = svg.replace(/<svg([^>]*)>/, (m, attrs) => {
    let a = attrs.replace(/\bwidth="[^"]*"/g, '').replace(/\bheight="[^"]*"/g, '')
    return `<svg${a} width="${SIZE}" height="${SIZE}">`
  })
  try {
    const png = new Resvg(fitted, {
      fitTo: { mode: 'width', value: SIZE },
      background: 'rgba(0,0,0,0)'
    }).render().asPng()
    fs.writeFileSync(path.join(OUT, file.replace(/\.svg$/, '.png')), png)
    count++
  } catch (e) {
    console.error('FAIL', file, e.message)
  }
}
console.log(`[svg2png] ${files.length} svg -> ${count} png in ${DIR}`)
