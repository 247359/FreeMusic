/**
 * 播放队列与播放控制
 */

import {
	player,
	settings,
	addHistory,
	isLiked,
	savePlayerState,
	savePlaybackProgress,
	saveSettings,
	clearPlayerState
} from './store.js'
import * as api from './api.js'
import { PLAYBACK_RATES } from './config.js'
import { initAudio, playUrl, pause, resume, stop, seek, setPlaybackRate, takeMedia3PlayerPageRequest } from './audio.js'
import { toast } from './format.js'

let playToken = 0
let dragging = false
let started = false
let playerPageReady = false

export function openPlayerPage() {
	const pages = getCurrentPages()
	if (!currentTrack() || pages[pages.length - 1]?.route === 'pages/player/player') return
	uni.navigateTo({ url: '/pages/player/player', animationType: 'slide-in-bottom', animationDuration: 260 })
}

function openRequestedPlayerPage() {
	if (playerPageReady && takeMedia3PlayerPageRequest()) openPlayerPage()
}

export function setPlayerPageReady(ready) {
	playerPageReady = ready
	if (ready) openRequestedPlayerPage()
}
/** 本会话是否已通过 playAt 真正加载过音频源。冷启动恢复队列后为 false，点播放需重新加载 */
let sourceLoaded = false
let sourceReady = false
let triedAlternate = false
/** 连续播放失败计数，用于熔断，避免坏歌导致无限跳曲 */
let consecutiveErrors = 0
let saveTimer = null
/** 失败跳曲的延时任务；用户主动切歌时需清除，避免旧回调覆盖新曲 */
let errorJumpTimer = null
let endedAdvanceTimer = null
/** 冷启动续播：src 设置后需等 canplay 才能 seek，暂存目标秒数 */
let pendingSeek = 0
let seekPreviewUntil = 0
/** 睡眠定时器 */
let sleepTimer = null
let sleepDeadline = 0

function cancelErrorJump() {
	if (errorJumpTimer) {
		clearTimeout(errorJumpTimer)
		errorJumpTimer = null
	}
}

function cancelEndedAdvance() {
	if (endedAdvanceTimer == null) return
	clearTimeout(endedAdvanceTimer)
	endedAdvanceTimer = null
}

function stopAtEnd() {
	playToken++
	sourceLoaded = false
	sourceReady = false
	pendingSeek = 0
	seekPreviewUntil = 0
	player.playing = false
	player.currentTime = 0
	stop()
	savePlayerState()
}

function onTrackEnded() {
	if (!sourceLoaded || endedAdvanceTimer != null) return
	const token = playToken
	// Let the native player finish its own end-of-track reset before starting another track.
	endedAdvanceTimer = setTimeout(() => {
		endedAdvanceTimer = null
		if (token !== playToken) return
		if (player.sleepAtEnd) {
			player.sleepAtEnd = false
			stopAtEnd()
			toast('定时停止：本曲已播完')
			return
		}
		next(true)
	}, 0)
}

/** 节流落盘，避免 progress 每次 timeupdate 都写存储 */
function persistSoon(delay = 800) {
	if (saveTimer) return
	saveTimer = setTimeout(() => {
		saveTimer = null
		savePlaybackProgress()
	}, delay)
}

export function currentTrack() {
	return player.queue[player.index] || null
}

export function hasQueue() {
	return player.queue.length > 0
}

/** 进度节流：timeupdate 高频触发时，只在时间推进 >=0.25s 或跳变时写 store，
 *  否则每次 tick 都会让播放页/迷你播放器整树重渲染，实测会把主线程打满 */
const TIME_EPS = 0.25
function applyTime(data) {
	if (!data) return
	if (!dragging && Number.isFinite(data.currentTime) && Date.now() >= seekPreviewUntil) {
		const next = data.currentTime
		const prev = player.currentTime
		// 正常推进与任意方向的跳变（seek/切歌/回退）都要更新，只过滤微小的重复 tick
		if (Math.abs(next - prev) >= TIME_EPS || next === 0 || next < prev - 0.05) {
			player.currentTime = next
		}
	}
	if (Number.isFinite(data.duration) && data.duration > 0) {
		const d = Math.round(data.duration * 100) / 100
		if (d > 0 && Math.abs(d - player.duration) >= 0.1) player.duration = d
	}
}

/** 音频出错：自动跳过当前曲；连续失败到阈值则熔断，避免无限循环跳曲 */
function handlePlayError() {
	player.playing = false
	sourceLoaded = false
	sourceReady = false
	if (currentTrack() && !triedAlternate) {
		toast('正在尝试备用音频流')
		playAt(player.index, player.currentTime, true)
		return
	}
	consecutiveErrors++
	if (consecutiveErrors >= 3) {
		consecutiveErrors = 0
		stop()
		toast('连续播放失败，请检查网络或服务器')
		return
	}
	toast('播放失败，尝试下一首')
	cancelErrorJump()
	errorJumpTimer = setTimeout(() => {
		errorJumpTimer = null
		next(player.mode !== 'one')
	}, 700)
}

export function initPlayerEngine() {
	if (started) return
	started = true
	// 应用已保存的倍速（在音频上下文创建后设置）
	const savedRate = Number(settings.playbackRate)
	player.rate = savedRate === 0.75 ? 0.8 : PLAYBACK_RATES.includes(savedRate) ? savedRate : 1
	if (settings.playbackRate !== player.rate) {
		settings.playbackRate = player.rate
		saveSettings()
	}
	initAudio({
		openplayer: openRequestedPlayerPage,
		play: () => {
			player.playing = true
		},
		pause: () => {
			player.playing = false
			savePlaybackProgress()
		},
		stop: () => {
			player.playing = false
		},
		ended: onTrackEnded,
		next: () => next(false),
		prev: () => prev(),
		timeupdate: (data) => {
			applyTime(data)
			persistSoon(1500)
		},
		seekunavailable: (data) => {
			seekPreviewUntil = 0
			applyTime(data)
			savePlayerState()
			toast('当前音频流不支持跳转')
		},
		canplay: (data) => {
			sourceReady = true
			applyTime(data)
			consecutiveErrors = 0
			if (pendingSeek > 0) {
				const target = pendingSeek
				pendingSeek = 0
				seek(target)
				player.currentTime = target
			}
		},
		error: (e) => handlePlayError(e)
	})
	setPlaybackRate(player.rate)
}

/** 设置播放队列并从 index 开始播放 */
export function setQueue(tracks, index = 0, meta = {}) {
	const list = (tracks || []).filter(Boolean)
	if (!list.length) {
		toast('没有可播放的歌曲')
		return
	}
	player.queue = list
	player.index = Math.max(0, Math.min(index, list.length - 1))
	player.meta = meta || {}
	player.isFM = !!meta.isFM
	player.visible = true
	consecutiveErrors = 0
	playAt(player.index)
}

/** 单曲播放：可指定所在队列 */
export function playTrack(track, queue, index) {
	if (!track) return
	if (queue && queue.length) {
		const i = typeof index === 'number' ? index : queue.findIndex((t) => t.id === track.id)
		player.queue = queue.slice()
		player.index = Math.max(0, i)
		player.meta = {}
		player.isFM = false
		player.visible = true
		playAt(player.index)
	} else {
		setQueue([track], 0, { name: track.name })
	}
}

export function playAt(index, resumeAt = 0, alternate = false) {
	const track = player.queue[index]
	if (!track) return
	cancelErrorJump()
	cancelEndedAdvance()
	const token = ++playToken
	const resume = Number(resumeAt) > 0 ? Number(resumeAt) : 0
	const previouslyReady = sourceLoaded && sourceReady
	player.index = index
	player.currentTime = resume
	player.duration = track.duration || 0
	player.playing = false
	player.visible = true
	pendingSeek = resume
	seekPreviewUntil = 0
	sourceLoaded = false
	sourceReady = false
	triedAlternate = alternate
	if (player.duration <= 0) {
		api.getSong(track.id).then((detail) => {
			if (token === playToken && currentTrack() === track && player.duration <= 0 && detail.duration > 0) {
				player.duration = detail.duration
			}
		}).catch(() => {})
	}

	api
		.getTrackUrl(track, alternate)
		.then((url) => {
			if (token !== playToken || currentTrack() !== track) return
			const reused = playUrl(url, {
				name: track.name,
				artist: track.artistName,
				picUrl: track.picUrl,
				duration: player.duration
			}, previouslyReady ? pendingSeek : null)
			if (reused) {
				sourceReady = true
				pendingSeek = 0
				seekPreviewUntil = Date.now() + 800
			}
			sourceLoaded = true
			player.playing = true
			addHistory(track)
			savePlayerState()
		})
		.catch((err) => {
			if (token !== playToken) return
			player.playing = false
			handlePlayError(err)
		})
}

export function toggle() {
	const track = currentTrack()
	if (!track) return
	if (player.playing) {
		cancelEndedAdvance()
		pause()
		player.playing = false
		savePlayerState()
	} else {
		// 冷启动/切账号后队列已恢复，但音频上下文尚未加载源，必须重新 playAt
		if (!sourceLoaded) {
			// 带上持久化的进度，实现断点续播
			playAt(player.index, player.currentTime)
			return
		}
		resume()
		player.playing = true
		savePlayerState()
	}
}

export function pausePlayback() {
	cancelEndedAdvance()
	pause()
	player.playing = false
	savePlayerState()
}

export function next(auto = false) {
	const list = player.queue
	if (!list.length) return

	if (player.isFM && (!auto || player.mode === 'shuffle')) {
		if (player.index + 1 < list.length) playAt(player.index + 1)
		else loadMoreFM()
		return
	}

	if (player.mode === 'one' && auto) {
		playAt(player.index)
		return
	}

	let ni = -1
	if (player.mode === 'shuffle') {
		if (list.length > 1) {
			do {
				ni = Math.floor(Math.random() * list.length)
			} while (ni === player.index)
		} else {
			ni = 0
		}
	} else if (player.index + 1 < list.length) {
		ni = player.index + 1
	} else if (player.mode === 'repeat') {
		ni = 0
	} else if (!auto) {
		ni = 0
	} else {
		stopAtEnd()
		return
	}
	playAt(ni)
}

export function prev() {
	const list = player.queue
	if (!list.length) return
	if (player.currentTime > 3) {
		seek(0)
		player.currentTime = 0
		return
	}
	let pi = player.index - 1
	if (pi < 0) pi = player.mode === 'repeat' ? list.length - 1 : 0
	playAt(pi)
}

export function setMode(mode) {
	const modes = ['order', 'repeat', 'shuffle', 'one']
	if (mode) {
		player.mode = modes.indexOf(mode) !== -1 ? mode : 'order'
	} else {
		player.mode = modes[(modes.indexOf(player.mode) + 1) % modes.length]
	}
	toast(
		{ order: '顺序播放', repeat: '列表循环', shuffle: '随机播放', one: '单曲循环' }[
			player.mode
		]
	)
	savePlayerState()
	return player.mode
}

export function seekTo(sec) {
	if (!currentTrack() || !Number.isFinite(sec)) return
	const target = Math.max(0, player.duration > 0 ? Math.min(player.duration, sec) : sec)
	if (sourceLoaded && sourceReady) {
		pendingSeek = 0
		seekPreviewUntil = Date.now() + 800
		seek(target)
	} else {
		pendingSeek = target
	}
	player.currentTime = target
	savePlayerState()
}

/* ============ 播放倍速 ============ */

export function setRate(rate) {
	const r = Number(rate)
	player.rate = PLAYBACK_RATES.includes(r) ? r : 1
	settings.playbackRate = player.rate
	saveSettings()
	setPlaybackRate(player.rate)
	toast('播放速度 ' + player.rate + 'x')
	return player.rate
}

/* ============ 睡眠定时 ============ */

export function refreshSleepTimer() {
	if (!sleepDeadline) return
	if (sleepTimer) clearTimeout(sleepTimer)
	const remaining = sleepDeadline - Date.now()
	player.sleepRemaining = Math.max(0, Math.ceil(remaining / 1000))
	if (remaining <= 0) {
		clearSleepTimer()
		pausePlayback()
		toast('睡眠定时结束，已暂停播放')
		return
	}
	sleepTimer = setTimeout(refreshSleepTimer, Math.min(remaining, 1000))
}

/** 设置睡眠定时（分钟）；minutes<=0 表示关闭。endOfTrack=true 表示本曲结束停止 */
export function setSleepTimer(minutes, endOfTrack = false) {
	clearSleepTimer()
	if (endOfTrack) {
		player.sleepAtEnd = true
		player.sleepRemaining = 0
		toast('将在当前歌曲结束后停止')
		return
	}
	const m = Number(minutes)
	if (m > 0) {
		sleepDeadline = Date.now() + m * 60000
		refreshSleepTimer()
		toast(m + ' 分钟后停止播放')
	} else {
		toast('已关闭睡眠定时')
	}
}

export function clearSleepTimer() {
	sleepDeadline = 0
	if (sleepTimer) {
		clearTimeout(sleepTimer)
		sleepTimer = null
	}
	player.sleepRemaining = 0
	player.sleepAtEnd = false
}

export function beginDrag() {
	dragging = true
}

export function endDrag(sec) {
	dragging = false
	seekTo(sec)
}

export function startFM() {
	return api.getRandomSongs(12).then((tracks) => {
		if (!tracks.length) {
			toast('曲库中没有可播放的歌曲')
			return
		}
		setQueue(tracks, 0, { isFM: true, name: '随机漫游' })
	})
}

function loadMoreFM() {
	if (player.isLoadingFM) return
	const queue = player.queue
	const token = playToken
	player.isLoadingFM = true
	api
		.getRandomSongs(12)
		.then((tracks) => {
			if (!player.isFM || player.queue !== queue || token !== playToken) return
			const exist = {}
			player.queue.forEach((t) => (exist[t.id] = 1))
			const fresh = tracks.filter((t) => !exist[t.id])
			if (!fresh.length) {
				player.playing = false
				return
			}
			// FM 队列只保留当前及之后的曲，丢弃已播过的旧曲，避免队列无限增长
			const kept = player.queue.slice(player.index)
			const firstNew = kept.length
			player.queue = kept.concat(fresh)
			// 播放新追加的第一首，而不是当前曲后面那首可能听过的旧歌
			playAt(firstNew)
			savePlayerState()
		})
		.catch(() => {
			if (player.isFM && player.queue === queue && token === playToken) {
				pausePlayback()
				toast('随机漫游加载失败，请重试')
			}
		})
		.finally(() => {
			player.isLoadingFM = false
		})
}

export function toggleLike() {
	const track = currentTrack()
	if (!track) return
	const nextLiked = !isLiked(track.id)
	api
		.likeTrack(track, nextLiked)
		.then(() => toast(nextLiked ? '已添加到我喜欢的音乐' : '已取消喜欢'))
		.catch((e) => toast(e.message || '操作失败'))
}

export function enqueueTrack(track, playNext = false) {
	if (!track || !track.id) return
	if (!currentTrack()) {
		player.queue = [track]
		player.index = 0
		player.currentTime = 0
		player.duration = Number(track.duration) || 0
		player.meta = { name: '播放队列' }
		player.visible = true
		player.playing = false
		player.isFM = false
		sourceLoaded = false
		sourceReady = false
	} else if (playNext) {
		const nextIndex = player.index + 1
		const existing = player.queue.findIndex((item, index) => index >= nextIndex && item.id === track.id)
		if (existing >= 0) moveQueueTrack(existing, nextIndex)
		else player.queue.splice(nextIndex, 0, track)
	} else {
		player.queue.push(track)
	}
	savePlayerState()
	toast(playNext ? '已设为下一首播放' : '已加入播放队列')
}

export function enqueueTracks(tracks) {
	const valid = tracks.filter((track) => track?.id)
	if (!valid.length) return
	if (!currentTrack()) {
		enqueueTrack(valid.shift())
		if (!valid.length) return
	}
	player.queue.push(...valid)
	savePlayerState()
	toast('已加入播放队列')
}

export function moveQueueTrack(from, to) {
	const queue = player.queue
	if (![from, to].every((index) => Number.isInteger(index) && index >= 0 && index < queue.length) || from === to) return
	const current = player.index
	const [track] = queue.splice(from, 1)
	queue.splice(to, 0, track)
	if (current === from) player.index = to
	else if (from < current && to >= current) player.index--
	else if (from > current && to <= current) player.index++
	savePlayerState()
}

export function removeFromQueue(index) {
	if (index < 0 || index >= player.queue.length) return
	player.queue.splice(index, 1)
	if (!player.queue.length) {
		playToken++
		cancelErrorJump()
		cancelEndedAdvance()
		clearSleepTimer()
		if (saveTimer) {
			clearTimeout(saveTimer)
			saveTimer = null
		}
		stop()
		player.playing = false
		player.visible = false
		sourceLoaded = false
		clearPlayerState()
		return
	}
	if (index < player.index) player.index--
	else if (index === player.index) playAt(Math.min(index, player.queue.length - 1))
	savePlayerState()
}
