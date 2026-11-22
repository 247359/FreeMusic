import { onMedia3Event, loadMedia3, controlMedia3 } from '@/uni_modules/freemusic-media3'
export { takeMedia3PlayerPageRequest } from '@/uni_modules/freemusic-media3'

let media3Url = ''

export function initAudio(handlers) {
	onMedia3Event((name, currentTime, duration) => {
		try {
			handlers[name]?.({ currentTime, duration })
		} catch (error) {
			console.warn('[FreeMusic] audio listener error', name, error)
		}
	})
}

export function playUrl(url, meta = {}, reuseAt = null) {
	if (!url) return
	const reused = reuseAt !== null && media3Url === url
	if (reused) {
		controlMedia3('seek', reuseAt)
		controlMedia3('play', 0)
	} else {
		media3Url = url
		loadMedia3(url, meta.name || 'FreeMusic', meta.artist || '', meta.picUrl || '', Number(meta.duration) || 0)
	}
	return reused
}

export function pause() {
	if (media3Url) controlMedia3('pause', 0)
}

export function resume() {
	if (media3Url) controlMedia3('play', 0)
}

export function stop() {
	if (media3Url) controlMedia3('stop', 0)
	media3Url = ''
}

export function seek(seconds) {
	if (media3Url) controlMedia3('seek', Math.max(0, Number(seconds) || 0))
}

export function setPlaybackRate(rate) {
	if (Number(rate) > 0) controlMedia3('rate', Number(rate))
}
