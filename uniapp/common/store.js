import { reactive } from 'vue'
import { KEYS, DEFAULT_SETTINGS, sysInfo } from './config.js'
import { isUnknownAlbumCover } from './format.js'

function clone(obj) {
	return JSON.parse(JSON.stringify(obj))
}

function read(key, fallback) {
	try {
		const v = uni.getStorageSync(key)
		if (!v) return clone(fallback)
		if (typeof v === 'string') return JSON.parse(v)
		return v
	} catch (e) {
		return clone(fallback)
	}
}

function write(key, value) {
	try {
		uni.setStorageSync(key, value)
	} catch (e) {
		console.warn('[FreeMusic] storage write failed', key, e)
	}
}

function deepMerge(base, extra) {
	const out = clone(base)
	Object.keys(extra || {}).forEach((k) => {
		if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) {
			out[k] = Object.assign(out[k] || {}, extra[k])
		} else {
			out[k] = extra[k]
		}
	})
	return out
}

/* ============ 全局响应式状态 ============ */

const savedSettings = read(KEYS.settings, {})
export const settings = reactive(deepMerge(DEFAULT_SETTINGS, savedSettings))
// 保证嵌套默认值一定存在
settings.navidrome = Object.assign({}, DEFAULT_SETTINGS.navidrome, settings.navidrome || {})
if (Number(settings.navidrome.bitrate) > 320) settings.navidrome.bitrate = 320

export const user = reactive({
	connected: false,
	username: settings.navidrome.username || '',
	server: settings.navidrome.server || '',
	version: ''
})

export const player = reactive({
	queue: [],
	index: -1,
	meta: {},
	playing: false,
	currentTime: 0,
	duration: 0,
	mode: 'order', // order | repeat | one | shuffle
	isFM: false,
	visible: false,
	rate: 1, // 当前播放倍速
	sleepRemaining: 0, // 睡眠定时剩余秒数，0 表示未开启
	sleepAtEnd: false // 本曲播放结束后停止
})

export const likedIds = reactive({ list: [] })
export const history = reactive({ list: [] })
/** 本地星级缓存：{ [trackId]: 1..5 }，与服务端 userRating 同步 */
export const ratings = reactive({ map: read(KEYS.ratings, {}) })
const trackLyricOffsets = reactive(read(KEYS.trackLyricOffsets, {}) || {})

function trackLyricOffsetKey(id) {
	return JSON.stringify([settings.navidrome.server, settings.navidrome.username, String(id)])
}

export function getTrackLyricOffset(id) {
	return id ? Number(trackLyricOffsets[trackLyricOffsetKey(id)]) || 0 : 0
}

export function setTrackLyricOffset(id, offset) {
	if (!id || !Number.isFinite(offset)) return
	const key = trackLyricOffsetKey(id)
	if (offset === 0) delete trackLyricOffsets[key]
	else trackLyricOffsets[key] = offset
	write(KEYS.trackLyricOffsets, trackLyricOffsets)
}
/** 本地播放统计：{ [trackId]: { count, lastAt, track } }，用于"最常播放" */
export const playStats = reactive({ map: read(KEYS.playStats, {}) })
export const themeState = reactive({ isDark: false, ready: false })
/** 连接配置版本号：连接/断开后自增，页面据此刷新缓存数据 */
export const appState = reactive({ configVersion: 0 })

/* ============ 设置持久化 ============ */

export function saveSettings() {
	write(KEYS.settings, settings)
}

export function updateNavidrome(patch) {
	Object.assign(settings.navidrome, patch)
	saveSettings()
}

/* ============ 主题 ============ */

export function systemIsDark() {
	try {
		const info = sysInfo()
		if (info.theme) return info.theme === 'dark'
		if (info.osTheme) return info.osTheme === 'dark'
	} catch (e) {}
	return false
}

export function isDark() {
	if (settings.theme === 'dark') return true
	if (settings.theme === 'auto') return systemIsDark()
	return false
}

export function applyTheme() {
	const dark = isDark()
	themeState.isDark = dark
	themeState.ready = true
	try {
		if (uni.setBackgroundColor) {
			uni.setBackgroundColor({
				backgroundColor: dark ? '#222222' : '#ffffff',
				backgroundColorTop: dark ? '#222222' : '#ffffff',
				backgroundColorBottom: dark ? '#222222' : '#ffffff'
			})
		}
		// #ifdef APP-PLUS
		if (uni.setNavigationBarColor) {
			uni.setNavigationBarColor({
				frontColor: dark ? '#ffffff' : '#000000',
				backgroundColor: dark ? '#222222' : '#ffffff'
			})
		}
		// #endif
	} catch (e) {
		// H5 等平台可能未实现原生背景色设置，页面自身背景色已经处理
	}
}

/**
 * 页面根元素绑定：:class="themeClass"
 * 返回普通 getter（而非 computed ref），兼容 HBuilderX 各版本 Vue3 编译器。
 */
export function useTheme() {
	return {
		themeClass() {
			return themeState.isDark ? 'theme-dark' : 'theme-light'
		}
	}
}

/* ============ 星标（喜欢） ============ */

export function setLikedIds(ids) {
	likedIds.list = (ids || []).map(String)
	write(KEYS.liked, likedIds.list)
}

export function isLiked(id) {
	return likedIds.list.indexOf(String(id)) !== -1
}

export function markLiked(id, liked) {
	const s = String(id)
	const i = likedIds.list.indexOf(s)
	if (liked && i === -1) likedIds.list.push(s)
	if (!liked && i !== -1) likedIds.list.splice(i, 1)
	write(KEYS.liked, likedIds.list)
}

/* ============ 播放历史 ============ */

export function addHistory(track) {
	if (!track || !track.id) return
	const item = {
		id: String(track.id),
		name: track.name,
		artists: track.artists || [],
		artistName: track.artistName || '',
		album: track.album || {},
		picUrl: track.picUrl || '',
		thumbUrl: track.thumbUrl || '',
		duration: track.duration || 0,
		source: track.source || 'navidrome',
		extra: track.extra || {},
		at: Date.now()
	}
	const list = history.list.filter((t) => t.id !== item.id)
	list.unshift(item)
	history.list = list.slice(0, settings.historyLimit || 100)
	write(KEYS.history, history.list)
	// 同步累计播放次数（用于"最常播放"）
	addPlayCount(item)
}

export function clearHistory() {
	history.list = []
	write(KEYS.history, [])
}

/* ============ 播放统计（最常播放） ============ */

/** 记录一次播放：累计次数并保存最近播放的曲目快照 */
export function addPlayCount(track) {
	if (!track || !track.id) return
	const id = String(track.id)
	const prev = playStats.map[id] || { count: 0, lastAt: 0, track: null }
	playStats.map[id] = {
		count: (prev.count || 0) + 1,
		lastAt: Date.now(),
		track: {
			id,
			name: track.name,
			artists: track.artists || [],
			artistName: track.artistName || '',
			album: track.album || {},
			picUrl: track.picUrl || '',
			thumbUrl: track.thumbUrl || '',
			duration: track.duration || 0,
			source: track.source || 'navidrome',
			extra: track.extra || {}
		}
	}
	write(KEYS.playStats, playStats.map)
}

/** 按播放次数降序返回曲目列表（最多 limit 首） */
export function getMostPlayed(limit = 100) {
	const rows = Object.keys(playStats.map).map((id) => playStats.map[id])
	rows.sort((a, b) => (b.count || 0) - (a.count || 0))
	return rows
		.filter((r) => r.track && r.count > 0)
		.slice(0, limit)
		.map((r) => Object.assign({}, r.track, { playCount: r.count, lastAt: r.lastAt }))
}

export function clearPlayStats() {
	playStats.map = {}
	write(KEYS.playStats, {})
}

/* ============ 星级评分 ============ */

export function getRating(id) {
	return Number(ratings.map[String(id)] || 0)
}

export function setLocalRating(id, value) {
	const s = String(id)
	const v = Math.max(0, Math.min(5, Number(value) || 0))
	if (v > 0) ratings.map[s] = v
	else delete ratings.map[s]
	write(KEYS.ratings, ratings.map)
}

/** 从服务端曲目对象同步一次评分（userRating） */
export function syncRating(id, userRating) {
	const v = Number(userRating || 0)
	if (v > 0) setLocalRating(id, v)
}

/* ============ 播放状态持久化 ============ */
export function savePlaybackProgress() {
	const track = player.queue[player.index]
	if (!track) return
	write(KEYS.playerProgress, {
		id: track.id,
		index: player.index,
		currentTime: player.currentTime,
		duration: player.duration
	})
}

/** 保存队列结构；频繁的播放进度单独记录。 */
export function savePlayerState() {
	if (!player.queue || !player.queue.length) {
		write(KEYS.player, null)
		write(KEYS.playerProgress, null)
		return
	}
	savePlaybackProgress()
	write(KEYS.player, {
		queue: player.queue.slice(),
		index: player.index,
		mode: player.mode,
		meta: player.meta || {},
		currentTime: player.currentTime || 0,
		isFM: !!player.isFM
	})
}

/** 恢复上次播放状态；不自动播放（音频源需用户触发），playing 恒为 false */
function removeLegacyCover(track) {
	if (!track || track.source !== 'navidrome' || !track.extra) return track
	if (track.extra.coverArt !== '' && !isUnknownAlbumCover(track.album && track.album.name, track.extra.coverArt)) return track
	return { ...track, picUrl: '', thumbUrl: '' }
}

export function restorePlayerState() {
	const s = read(KEYS.player, null)
	if (!s || !Array.isArray(s.queue) || !s.queue.length) return
	player.queue = s.queue.filter((t) => t && t.id).map(removeLegacyCover)
	if (!player.queue.length) return
	player.index = Math.max(0, Math.min(Number(s.index) || 0, player.queue.length - 1))
	player.mode = ['order', 'repeat', 'shuffle', 'one'].indexOf(s.mode) !== -1 ? s.mode : 'order'
	player.meta = s.meta && typeof s.meta === 'object' ? s.meta : {}
	const track = player.queue[player.index]
	const progress = read(KEYS.playerProgress, null)
	const matched = progress && progress.id === track.id && progress.index === player.index
	const savedDuration = Number(matched ? progress.duration : 0)
	const metadataDuration = Number(track.duration)
	const duration = Number.isFinite(savedDuration) && savedDuration > 0 ? savedDuration
		: Number.isFinite(metadataDuration) && metadataDuration > 0 ? metadataDuration : 0
	const time = Math.max(0, Number(matched ? progress.currentTime : s.currentTime) || 0)
	if (matched && duration > 0) track.duration = duration
	player.duration = duration
	player.currentTime = duration > 0 ? Math.min(time, duration) : time
	player.isFM = !!s.isFM
	player.visible = true
	player.playing = false
}

/** 断开连接时清空队列缓存，避免残留旧账号曲目 */
export function clearPlayerState() {
	player.queue = []
	player.index = -1
	player.meta = {}
	player.currentTime = 0
	player.duration = 0
	player.playing = false
	player.visible = false
	player.isFM = false
	write(KEYS.player, null)
	write(KEYS.playerProgress, null)
}

/* ============ 搜索历史 ============ */

export function getSearchHistory() {
	return read(KEYS.searchHistory, [])
}

export function addSearchHistory(keyword) {
	const k = String(keyword || '').trim()
	if (!k) return
	const list = [k].concat(getSearchHistory().filter((x) => x !== k)).slice(0, 12)
	write(KEYS.searchHistory, list)
}

export function clearSearchHistory() {
	write(KEYS.searchHistory, [])
}

/* ============ 启动加载 ============ */

export function initApp() {
	const h = read(KEYS.history, [])
	history.list = Array.isArray(h) ? h.filter(Boolean).map(removeLegacyCover) : []
	const l = read(KEYS.liked, [])
	likedIds.list = Array.isArray(l) ? l.map(String) : []
	user.username = settings.navidrome.username || ''
	user.server = settings.navidrome.server || ''
	themeState.isDark = isDark()
	themeState.ready = true
	seedPlayStatsFromHistory()
	restorePlayerState()
}

/** 首次引入本地播放统计时，用已有播放历史做种子，避免"最常播放"一开始为空 */
function seedPlayStatsFromHistory() {
	if (Object.keys(playStats.map).length > 0) return
	if (!history.list.length) return
	const seed = {}
	history.list.forEach((t) => {
		if (!t || !t.id) return
		const id = String(t.id)
		seed[id] = {
			count: 1,
			lastAt: t.at || Date.now(),
			track: {
				id,
				name: t.name,
				artists: t.artists || [],
				artistName: t.artistName || '',
				album: t.album || {},
				picUrl: t.picUrl || '',
				thumbUrl: t.thumbUrl || '',
				duration: t.duration || 0,
				source: t.source || 'navidrome',
				extra: t.extra || {}
			}
		}
	})
	if (Object.keys(seed).length) {
		playStats.map = seed
		write(KEYS.playStats, seed)
	}
}
