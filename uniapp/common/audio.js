/**
 * 音频播放封装
 * App 端使用 BackgroundAudioManager（锁屏/通知栏控制、后台播放），
 * H5 / 不支持的平台回退到 InnerAudioContext。
 */

let ctx = null
let isBackground = false
let bound = false
const listeners = {}

function ensure() {
	if (ctx) return ctx

	let platform = ''
	try {
		platform = (uni.getSystemInfoSync && uni.getSystemInfoSync().platform) || ''
	} catch (e) {}

	if (platform !== 'h5' && typeof uni.getBackgroundAudioManager === 'function') {
		try {
			ctx = uni.getBackgroundAudioManager()
			isBackground = true
		} catch (e) {
			ctx = null
		}
	}
	if (!ctx) {
		ctx = uni.createInnerAudioContext()
		isBackground = false
	}
	bindEvents()
	return ctx
}

function emit(name, arg) {
	const fn = listeners[name]
	if (typeof fn === 'function') {
		try {
			fn(arg)
		} catch (e) {
			console.warn('[FreeMusic] audio listener error', name, e)
		}
	}
}

function bindEvents() {
	if (bound || !ctx) return
	bound = true

	ctx.onPlay && ctx.onPlay(() => {
		startTicker()
		emit('play')
	})
	ctx.onPause && ctx.onPause(() => {
		stopTicker()
		emitProgress(true)
		emit('pause')
	})
	ctx.onStop && ctx.onStop(() => {
		stopTicker()
		emit('stop')
	})
	ctx.onEnded && ctx.onEnded(() => {
		stopTicker()
		emit('ended')
	})
	ctx.onError && ctx.onError((e) => {
		stopTicker()
		emit('error', e)
	})
	ctx.onTimeUpdate && ctx.onTimeUpdate(() => {
		emit('timeupdate', {
			currentTime: ctx.currentTime || 0,
			duration: ctx.duration || 0
		})
	})
	ctx.onCanplay && ctx.onCanplay(() => {
		emit('canplay', { duration: ctx.duration || 0 })
	})
	ctx.onWaiting && ctx.onWaiting(() => emit('waiting'))
	ctx.onSeeked && ctx.onSeeked(() => {
		emit('timeupdate', {
			currentTime: ctx.currentTime || 0,
			duration: ctx.duration || 0
		})
	})

	// 系统播放器 / 耳机上的上一首、下一首
	if (ctx.onNext) ctx.onNext(() => emit('next'))
	if (ctx.onPrev) ctx.onPrev(() => emit('prev'))
}

export function initAudio(handlers) {
	Object.assign(listeners, handlers || {})
	return ensure()
}

/** 进度轮询兜底：BackgroundAudioManager 在部分基座上不回调 onTimeUpdate，
 *  用 500ms 轮询读 currentTime 补偿，同时天然把渲染频率限制在 2Hz */
let ticker = null
let lastEmitted = -1
let lastDuration = -1
function emitProgress(force) {
	if (!ctx) return
	const cur = Number(ctx.currentTime) || 0
	const dur = Number(ctx.duration) || 0
	if (!force && Math.abs(cur - lastEmitted) < 0.2 && dur === lastDuration) return
	lastEmitted = cur
	lastDuration = dur
	emit('timeupdate', { currentTime: cur, duration: dur })
}
function startTicker() {
	if (ticker) return
	lastEmitted = -1
	lastDuration = -1
	ticker = setInterval(() => emitProgress(false), 500)
}
function stopTicker() {
	if (ticker) clearInterval(ticker)
	ticker = null
}

export function playUrl(url, meta = {}, reuseAt = null) {
	const a = ensure()
	if (!url) return
	if (isBackground) {
		a.title = meta.name || 'FreeMusic'
		a.singer = meta.artist || ''
		a.coverImgUrl = meta.picUrl || ''
	}
	const reused = reuseAt !== null && a.src === url
	if (reused) a.seek(reuseAt)
	else a.src = url
	a.play()
	startTicker()
	return reused
}

export function pause() {
	if (!ctx) return
	try {
		ctx.pause()
	} catch (e) {}
	stopTicker()
}

export function resume() {
	if (!ctx) return
	try {
		ctx.play()
	} catch (e) {}
	startTicker()
}

export function stop() {
	stopTicker()
	if (!ctx) return
	try {
		ctx.stop()
	} catch (e) {}
}

export function seek(seconds) {
	if (!ctx) return
	try {
		if (typeof ctx.seek === 'function') ctx.seek(Math.max(0, Number(seconds) || 0))
	} catch (e) {}
}

export function setVolume(v) {
	if (!ctx || isBackground) return
	try {
		ctx.volume = Math.max(0, Math.min(1, Number(v)))
	} catch (e) {}
}

/** 播放倍速：BackgroundAudioManager 与 InnerAudioContext 均支持 playbackRate，部分基座不支持则静默忽略 */
export function setPlaybackRate(rate) {
	if (!ctx) return
	try {
		const r = Number(rate)
		if (r > 0 && ctx.playbackRate !== undefined) ctx.playbackRate = r
	} catch (e) {}
}

export function currentState() {
	if (!ctx) return { currentTime: 0, duration: 0 }
	return {
		currentTime: ctx.currentTime || 0,
		duration: ctx.duration || 0
	}
}

export function usingBackgroundAudio() {
	return isBackground
}
