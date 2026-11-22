/** 通用格式化工具 */

export function fmtTime(sec) {
	if (!sec || sec < 0 || !isFinite(sec)) return '0:00'
	const s = Math.floor(sec)
	const m = Math.floor(s / 60)
	const r = s % 60
	return m + ':' + String(r).padStart(2, '0')
}

export function fmtBitrate(track) {
	const rate = Number(track?.extra?.bitRate)
	return Number.isFinite(rate) && rate > 0 ? rate + ' kbps' : '未知'
}

export function fmtCount(n) {
	if (n === undefined || n === null) return ''
	n = Number(n)
	if (n < 10000) return String(n)
	if (n < 100000000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
	return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿'
}

export function fmtDate(ts) {
	if (!ts) return ''
	const d = new Date(Number(ts))
	if (isNaN(d.getTime())) return ''
	const p = (x) => String(x).padStart(2, '0')
	return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate())
}

export function todayLabel() {
	const d = new Date()
	const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
	return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + week[d.getDay()]
}

/** 密码按 Subsonic 规范做 UTF-8 十六进制编码 */
export function encHex(str) {
	str = String(str || '')
	if (typeof TextEncoder !== 'undefined') {
		const bytes = new TextEncoder().encode(str)
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	}
	// 兼容旧 WebView
	const escaped = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, hex) =>
		String.fromCharCode(parseInt(hex, 16))
	)
	let out = ''
	for (let i = 0; i < escaped.length; i++) {
		out += escaped.charCodeAt(i).toString(16).padStart(2, '0')
	}
	return out
}

export function queryString(params) {
	return Object.keys(params)
		.filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
		.flatMap((k) => (Array.isArray(params[k]) ? params[k] : [params[k]])
			.map((value) => encodeURIComponent(k) + '=' + encodeURIComponent(value)))
		.join('&')
}

export function toast(title, icon = 'none') {
	uni.showToast({ title: String(title || ''), icon, duration: 2000 })
}

export function confirm(content, title = '提示') {
	return new Promise((resolve) => {
		uni.showModal({
			title,
			content,
			success: (res) => resolve(!!res.confirm),
			fail: () => resolve(false)
		})
	})
}
export function genreLabel(name) {
	const key = String(name || '').trim().toLowerCase()
	if (key === 'other') return '其他'
	if (key === 'pop') return '流行'
	return name
}

export function isUnknownAlbumCover(album, coverArt) {
	return String(album || '').trim().toLowerCase() === '[unknown album]' &&
		String(coverArt || '').startsWith('al-')
}
