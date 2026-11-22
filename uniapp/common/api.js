/**
 * Navidrome / Subsonic REST API 客户端
 * 所有界面数据都来自这里，并统一归一化成应用内部模型：
 *   track  = { id, name, artists:[{id,name}], artistName, album:{id,name}, picUrl, duration, liked, source, extra }
 *   album  = { id, name, artist, artistId, picUrl, year, songCount, liked }
 *   artist = { id, name, picUrl, albumCount, liked }
 *   playlist = { id, name, picUrl, description, creator, trackCount, liked, virtual }
 */

import {
	settings,
	user,
	likedIds,
	setLikedIds,
	markLiked,
	playStats,
	saveSettings,
	appState,
	clearPlayerState
} from './store.js'
import { queryString, encHex, isUnknownAlbumCover } from './format.js'
import { stop as stopAudio } from './audio.js'
import { structuredLyrics } from './lyrics.js'

const API_VERSION = '1.16.1'
const CLIENT_NAME = 'FreeMusic'

function cfg() {
	return settings.navidrome
}

export function isConfigured() {
	const c = cfg()
	return !!(c && c.server && c.username && c.password)
}

function serverBase(input) {
	// 兼容用户把 /rest 也粘贴进来的情况
	return String(input || cfg().server || '')
		.replace(/\/rest\/?$/, '')
		.replace(/\/+$/, '')
}

function authParams(c) {
	return {
		u: c.username,
		p: 'enc:' + encHex(c.password),
		v: API_VERSION,
		c: CLIENT_NAME,
		f: 'json'
	}
}

/** 生成带认证参数的完整 URL，封面和音频直链也用它（image/audio 组件无法带自定义 Header） */
export function buildUrl(endpoint, params = {}, customCfg) {
	const c = customCfg || cfg()
	return (
		serverBase(c.server) +
		'/rest/' +
		endpoint +
		'?' +
		queryString(Object.assign(authParams(c), params))
	)
}

export function coverUrl(coverArt, size = 300) {
	if (!coverArt) return ''
	return buildUrl('getCoverArt', { id: coverArt, size: size })
}

export function streamUrl(track, alternate = false) {
	const params = { id: track.id }
	const bitrate = Number(cfg().bitrate || 0)
	if (alternate ? bitrate <= 0 : bitrate > 0) {
		params.maxBitRate = bitrate > 0 ? bitrate : 320
		params.format = 'mp3' // 统一转码为 mp3，保证 Android 全机型可播
	} else {
		params.format = 'raw'
	}
	return buildUrl('stream', params)
}

function request(endpoint, params = {}) {
	return new Promise((resolve, reject) => {
		if (!isConfigured()) {
			reject(new Error('请先在「设置」中连接 Navidrome 服务器'))
			return
		}
		uni.request({
			url: buildUrl(endpoint, params),
			method: 'GET',
			timeout: 20000,
			success(res) {
				if (res.statusCode !== 200) {
					reject(new Error('HTTP ' + res.statusCode + '，请检查服务地址'))
					return
				}
				const body = res.data && (res.data['subsonic-response'] || res.data)
				if (!body) {
					reject(new Error('服务端返回为空'))
					return
				}
				if (body.status !== 'ok') {
					reject(
						new Error(
							(body.error && body.error.message) || 'Navidrome 返回错误'
						)
					)
					return
				}
				resolve(body)
			},
			fail() {
				reject(new Error('无法连接音乐服务器，请检查网络后重试'))
			}
		})
	})
}

function safe(promise) {
	return promise
		.then((value) => ({ ok: true, value }))
		.catch((error) => ({ ok: false, error }))
}

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : [])

/* ==================== 数据归一化 ==================== */

export function toTrack(s) {
	if (!s) return null
	const artwork = isUnknownAlbumCover(s.album, s.coverArt) ? '' : s.coverArt
	return {
		id: String(s.id),
		name: s.title || '未知歌曲',
		artists: s.artist
			? [{ id: String(s.artistId || ''), name: s.artist }]
			: [],
		artistName: s.artist || '未知艺术家',
		album: { id: String(s.albumId || ''), name: s.album || '' },
		picUrl: coverUrl(artwork, 400),
		// 列表/迷你条缩略图用较小尺寸，节省流量并减轻长列表滚动时的网络压力
		thumbUrl: coverUrl(artwork, 120),
		duration: Number(s.duration || 0),
		liked: !!s.starred,
		userRating: Number(s.userRating || 0),
		source: 'navidrome',
		extra: {
			coverArt: s.coverArt || '',
			path: s.path || '',
			created: s.created || '',
			playCount: Number(s.playCount || 0),
			// 技术信息（歌曲信息面板用）
			suffix: s.suffix || '',
			contentType: s.contentType || '',
			bitRate: Number(s.bitRate || 0),
			sampleRate: Number(s.sampleRate || 0),
			channelCount: Number(s.channelCount || 0),
			bitDepth: Number(s.bitDepth || 0),
			size: Number(s.size || 0),
			discNumber: Number(s.discNumber || 0),
			track: Number(s.track || 0),
			year: Number(s.year || 0),
			genre: s.genre || ''
		}
	}
}

export function toAlbum(s) {
	if (!s) return null
	return {
		id: String(s.id),
		name: s.name || '未知专辑',
		artist: s.artist || '',
		artistId: String(s.artistId || ''),
		picUrl: coverUrl(isUnknownAlbumCover(s.name || s.title, s.coverArt) ? '' : s.coverArt, 400),
		year: s.year || 0,
		songCount: Number(s.songCount || 0),
		liked: !!s.starred,
		source: 'navidrome',
		extra: { coverArt: s.coverArt || '' }
	}
}

export function toArtist(s) {
	if (!s) return null
	return {
		id: String(s.id),
		name: s.name || '未知歌手',
		picUrl: s.coverArt ? coverUrl(s.coverArt, 300) : '',
		albumCount: Number(s.albumCount || 0),
		liked: !!s.starred,
		source: 'navidrome',
		extra: { coverArt: s.coverArt || '' }
	}
}

export function toPlaylist(s) {
	if (!s) return null
	return {
		id: String(s.id),
		name: s.name || '未命名歌单',
		picUrl: s.coverArt ? coverUrl(s.coverArt, 400) : '',
		description: s.comment || '',
		creator: s.owner || '',
		trackCount: Number(s.songCount || 0),
		liked: false,
		virtual: false,
		source: 'navidrome',
		extra: { coverArt: s.coverArt || '' }
	}
}

/* ==================== 连接与配置 ==================== */

/** 在保存前测试连接，直接用传入的参数，不改动当前配置 */
export function testConnection(connection) {
	const c = Object.assign(
		{},
		DEFAULT_CREDENTIALS(),
		connection || {}
	)
	if (!c.server || !c.username || !c.password) {
		return Promise.reject(new Error('请填写服务器地址、账号和密码'))
	}
	return new Promise((resolve, reject) => {
		uni.request({
			url: buildUrl('ping', {}, c),
			method: 'GET',
			timeout: 12000,
			success(res) {
				const body =
					res.data && (res.data['subsonic-response'] || res.data)
				if (res.statusCode === 200 && body && body.status === 'ok') {
					resolve({
						ok: true,
						version: body.version || '',
						type: body.type || 'Navidrome'
					})
				} else {
					const serverError = body && body.error
					const msg = serverError && Number(serverError.code) === 40
						? '账号或密码错误，请检查后重试'
						: (serverError && serverError.message) ||
							'连接失败（HTTP ' + res.statusCode + '），请检查服务器地址'
					reject(new Error(msg))
				}
			},
			fail() {
				reject(new Error('无法连接服务器，请检查地址与网络后重试'))
			}
		})
	})
}

function DEFAULT_CREDENTIALS() {
	return {
		server: '',
		username: '',
		password: '',
		bitrate: 320
	}
}

export function connect(connection) {
	// 先判断是否切换了服务器/账号（同一账号改码率等不视为切换）
	const c = cfg()
	const switched =
		(!!c.server && connection.server !== undefined && connection.server !== c.server) ||
		(!!c.username && connection.username !== undefined && connection.username !== c.username)
	Object.assign(c, connection)
	saveSettings()
	user.connected = true
	user.username = cfg().username
	user.server = serverBase()
	// 配置变化时清空缓存的喜欢状态，随后立即从服务端重建
	setLikedIds([])
	if (switched) {
		// 换服务器/账号：停止播放并丢弃旧曲队列，避免串到下个账号的歌
		stopAudio()
		clearPlayerState()
	}
	appState.configVersion++
	// 连接建立后立即拉取星标：首页、播放页、迷你条的喜欢状态不应等到进入音乐库才正确
	fetchLikedIds().catch(() => {})
}

export function disconnect() {
	user.connected = false
	user.username = ''
	user.server = ''
	user.version = ''
	setLikedIds([])
	stopAudio()
	clearPlayerState()
	appState.configVersion++
}

/* ==================== 专辑 / 歌手 / 歌单 ==================== */

export function getAlbumList2(type = 'newest', size = 20, offset = 0, genre = '') {
	const params = { type, size, offset }
	if (genre) params.genre = genre
	return request('getAlbumList2', params).then((res) =>
		arr(res.albumList2 && res.albumList2.album).map(toAlbum)
	)
}

export function getAlbumDetail(id) {
	return request('getAlbum', { id }).then((res) => {
		const album = toAlbum(res.album)
		const tracks = arr(res.album && res.album.song).map(toTrack)
		return { album, tracks }
	})
}

export function getAllArtists() {
	return request('getArtists').then((res) => {
		const groups = arr(res.artists && res.artists.index)
		const list = []
		groups.forEach((g) => arr(g.artist).forEach((a) => list.push(toArtist(a))))
		return list
	})
}

export function getArtistDetail(id) {
	// Subsonic getTopSongs 的 artist 参数是「歌手名」而不是 id：先取详情，再取热门歌曲
	// getArtist 是主请求，失败则向上抛出让页面显示错误态；getTopSongs 失败可兜底
	return request('getArtist', { id }).then(async (info) => {
		const name = (info.artist && info.artist.name) || ''
		const top = await request('getTopSongs', { artist: name, count: 50 }).catch(() => null)

		const rawArtist = info && info.artist
		const artist = toArtist(rawArtist) || { id: String(id), name: name }
		const albums = rawArtist ? arr(rawArtist.album).map(toAlbum) : []
		let tracks = top ? arr(top.topSongs && top.topSongs.song).map(toTrack) : []

		if (!tracks.length && albums.length) {
			// 服务端不支持 getTopSongs：取前 3 张专辑的歌曲兜底
			const details = await Promise.all(
				albums.slice(0, 3).map((a) => safe(getAlbumDetail(a.id)))
			)
			details.forEach((d) => {
				if (d.ok) tracks = tracks.concat(d.value.tracks)
			})
			tracks = tracks.slice(0, 50)
		}
		return { artist, albums, tracks }
	})
}

export function getGenres() {
	return request('getGenres').then((res) =>
		arr(res.genres && res.genres.genre)
			// OpenSubsonic 返回 `value`，旧版为 `name`，两者兼容；并剔除脏标签
			.map((g) => ({
				name: String(g.value || g.name || '').replace(/^\ufeff/, '').trim(),
				songCount: Number(g.songCount || 0),
				albumCount: Number(g.albumCount || 0)
			}))
			.filter((g) => g.name && g.name !== '<unknown>' && !/^\(\d+\)$/.test(g.name))
			.sort((a, b) => b.albumCount - a.albumCount)
	)
}

export function getPlaylists() {
	return request('getPlaylists').then((res) =>
		arr(res.playlists && res.playlists.playlist).map(toPlaylist)
	)
}

export function getPlaylistDetail(id) {
	const virtualTypes = {
		'virt:starred': 'starred',
		'virt:random': 'random',
		'virt:frequent': 'frequent'
	}
	if (virtualTypes[id]) {
		return getVirtualTracks(virtualTypes[id]).then((tracks) => ({
			playlist: toPlaylist({
				id,
				name:
					id === 'virt:starred'
						? '我喜欢的音乐'
						: id === 'virt:random'
						? '随机漫游'
						: '常听歌曲',
				songCount: tracks.length
			}),
			tracks
		}))
	}
	return request('getPlaylist', { id }).then((res) => {
		const p = res.playlist || {}
		return {
			playlist: toPlaylist(p),
			tracks: arr(p.entry || p.song).map(toTrack)
		}
	})
}

export function getVirtualTracks(type, size = 100) {
	if (type === 'starred') {
		return getStarred().then((r) => r.songs)
	}
	if (type === 'random') {
		return getRandomSongs(size)
	}
	if (type === 'frequent') {
		return getAlbumList2('frequent', 8, 0).then((albums) =>
			Promise.all(albums.map((a) => safe(getAlbumDetail(a.id))))
		).then((results) => {
			let tracks = []
			results.forEach((r) => {
				if (r.ok) tracks = tracks.concat(r.value.tracks)
			})
			return tracks.sort((a, b) => b.extra.playCount - a.extra.playCount).slice(0, size)
		})
	}
	return getAlbumList2(type, 8, 0).then((albums) =>
		Promise.all(albums.map((a) => safe(getAlbumDetail(a.id))))
	).then((results) => {
		let tracks = []
		results.forEach((r) => {
			if (r.ok) tracks = tracks.concat(r.value.tracks)
		})
		return tracks.slice(0, size)
	})
}

export function getRandomSongs(size = 40, filters = {}) {
	return request('getRandomSongs', { ...filters, size }).then((res) =>
		arr(res.randomSongs && res.randomSongs.song).map(toTrack)
	)
}

export function getDailySongs(size = 30) {
	const key = appState.configVersion + ':' + new Date().toDateString()
	if (dailyCache && dailyCache.key === key) return dailyCache.promise.then((tracks) => tracks.slice(0, size))
	const cache = { key, promise: null }
	cache.promise = getRandomSongs(40).then((tracks) => {
		if (!tracks.length && dailyCache === cache) dailyCache = null
		const seen = {}
		return tracks.filter((track) => {
			if (!track.id || seen[track.id]) return false
			seen[track.id] = true
			return true
		})
	}).catch((error) => {
		if (dailyCache === cache) dailyCache = null
		throw error
	})
	dailyCache = cache
	return cache.promise.then((tracks) => tracks.slice(0, size))
}

let dailyCache = null

export function getRediscoverySongs(size = 24) {
	return getRandomSongs(100).then((tracks) => {
		const seen = new Set()
		return tracks.filter((track) => {
			if (!track.id || seen.has(track.id)) return false
			seen.add(track.id)
			return true
		}).sort((a, b) => {
			const aPlays = playStats.map[a.id]
			const bPlays = playStats.map[b.id]
			return (aPlays && aPlays.count || 0) - (bPlays && bPlays.count || 0)
		}).slice(0, size)
	})
}

export function getStarred() {
	return request('getStarred2').then((res) => {
		const s = res.starred2 || {}
		return {
			songs: arr(s.song).map(toTrack),
			albums: arr(s.album).map(toAlbum),
			artists: arr(s.artist).map(toArtist)
		}
	})
}

/* ==================== 搜索 ==================== */

export function search(keyword, limit = 30) {
	const q = String(keyword || '').trim()
	if (!q) return Promise.resolve({ songs: [], albums: [], artists: [], playlists: [] })
	return request('search3', {
		query: q,
		songCount: limit,
		albumCount: limit,
		artistCount: limit,
		playlistCount: limit
	}).then((res) => {
		const r = res.searchResult3 || {}
		return {
			songs: arr(r.song).map(toTrack),
			albums: arr(r.album).map(toAlbum),
			artists: arr(r.artist).map(toArtist),
			playlists: arr(r.playlist).map(toPlaylist)
		}
	})
}

export function getLibraryTracks(offset, limit, query = '') {
	return request('search3', {
		query, songOffset: offset, songCount: limit, artistCount: 0, albumCount: 0
	}).then((res) => arr(res.searchResult3 && res.searchResult3.song).map(toTrack))
}

export async function getLibraryTrackCount(loadedCount) {
	const { scanStatus } = await request('getScanStatus')
	const count = scanStatus?.count
	if (scanStatus?.scanning || !Number.isSafeInteger(count) || count < loadedCount || count < 1) return null
	// The scan count can cover more libraries than this account can see.
	const boundary = await getLibraryTracks(count - 1, 2)
	return boundary.length === 1 ? count : null
}

export function getGenreTracks(genre, offset, count) {
	return request('getSongsByGenre', { genre, offset, count })
		.then((res) => arr(res.songsByGenre && res.songsByGenre.song).map(toTrack))
}

export function getHotKeywords() {
	return getGenres()
		.then((genres) => genres.slice(0, 12).map((g) => g.name))
		.catch(() => [])
}

/* ==================== 歌词 / 播放地址 / 星标 ==================== */

export function getLyrics(track) {
	if (!track || !track.id) return Promise.resolve({ lyric: [], tlyric: [] })
	return request('getLyricsBySongId', { id: track.id, enhanced: true })
		.then((res) => {
			const list = res.lyricsList && (res.lyricsList.structuredLyrics || res.lyricsList.lyrics)
			return structuredLyrics(list, track)
		})
		.catch(() => ({ lyric: [], tlyric: [] }))
}

export function getTrackUrl(track, alternate = false) {
	if (!track || !track.id) return Promise.reject(new Error('歌曲信息不完整'))
	return Promise.resolve(streamUrl(track, alternate))
}

/** 星标重建序号：只有最后一次发起的请求可以写入，避免换账号/并发时旧结果覆盖新状态 */
let likedFetchSeq = 0

export function fetchLikedIds() {
	const seq = ++likedFetchSeq
	return getStarred().then((r) => {
		if (seq !== likedFetchSeq) return likedIds.list
		setLikedIds(r.songs.map((t) => t.id))
		return likedIds.list
	})
}

/** 正在提交星标的曲目 id，防止快速连点发出相互抵消的 star/unstar */
const pendingLikes = {}

export function likeTrack(track, liked) {
	if (!track) return Promise.resolve()
	const id = String(track.id)
	if (pendingLikes[id]) return Promise.resolve()
	pendingLikes[id] = true
	// 乐观更新：先改本地状态让 UI 立即反馈，失败再回滚
	markLiked(id, !!liked)
	return request(liked ? 'star' : 'unstar', { id })
		.catch((e) => {
			markLiked(id, !liked)
			throw e
		})
		.finally(() => {
			delete pendingLikes[id]
		})
}

export function likeAlbum(id, liked) {
	return request(liked ? 'star' : 'unstar', { id }).then(() => {})
}

export function likeArtist(id, liked) {
	return request(liked ? 'star' : 'unstar', { id }).then(() => {})
}

/* ==================== 歌单管理 ==================== */

export function createPlaylist(name, trackIds = []) {
	return request('createPlaylist', { name, songId: trackIds }).then((res) => toPlaylist(res.playlist || {}))
}

export function addToPlaylist(playlistId, trackIds) {
	const ids = arr(trackIds).map(String)
	if (!ids.length) return Promise.resolve()
	return request('updatePlaylist', { playlistId, songIdToAdd: ids }).then(() => {})
}

export function renamePlaylist(playlistId, name) {
	return request('updatePlaylist', { playlistId, name }).then(() => {})
}

export function removeFromPlaylist(playlistId, index, trackId) {
	return getPlaylistDetail(playlistId).then((playlist) => {
		const track = playlist.tracks[index]
		if (!track || String(track.id) !== String(trackId)) {
			throw new Error('歌单已更新，请重新打开后重试')
		}
		return request('updatePlaylist', { playlistId, songIndexToRemove: index })
	})
}

export function deletePlaylist(playlistId) {
	return request('deletePlaylist', { id: playlistId }).then(() => {})
}

/* ==================== 评分与单曲详情 ==================== */

/** 取单曲完整信息（含格式/码率/采样率等），用于歌曲信息面板 */
export function getSong(id) {
	return request('getSong', { id: String(id) }).then((res) => toTrack(res.song))
}

/** 设置星级评分（0=清除，1..5） */
export function setRating(id, rating) {
	const v = Math.max(0, Math.min(5, Number(rating) || 0))
	return request('setRating', { id: String(id), rating: v }).then(() => v).catch((e) => {
		throw e
	})
}
