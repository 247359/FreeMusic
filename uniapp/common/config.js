/**
 * 全局常量与本机信息
 * 音源：Navidrome（Subsonic REST API），自建服务端，数据全部来自自己的媒体库
 */

import { ref } from 'vue'

export const KEYS = {
	settings: 'freemusic_settings_v1',
	liked: 'freemusic_liked_v1',
	history: 'freemusic_history_v1',
	searchHistory: 'freemusic_search_history_v1',
	player: 'freemusic_player_v1',
	playerProgress: 'freemusic_player_progress_v1',
	ratings: 'freemusic_ratings_v1',
	playStats: 'freemusic_playstats_v1',
	trackLyricOffsets: 'freemusic_track_lyric_offsets_v1'
}

export const DEFAULT_SETTINGS = {
	navidrome: {
		server: '', // 例如 https://music.example.com（不要带 /rest）
		username: '',
		password: '',
		bitrate: 320 // 流媒体最大码率 kbps，0 表示原文件直出
	},

	theme: 'light', // light | dark | auto
	lyricFontSize: 17,
	showTranslation: true,
	lyricsBackground: true,
	autoplay: true,
	historyLimit: 100,
	playbackRate: 1
}

export const PLAYBACK_RATES = [0.8, 1, 1.25, 1.5, 2]

let _sys = null
export function sysInfo() {
	if (!_sys) {
		try {
			_sys = uni.getSystemInfoSync()
		} catch (e) {
			_sys = {
				windowWidth: 375,
				windowHeight: 667,
				statusBarHeight: 20,
				safeAreaInsets: { bottom: 0 }
			}
		}
	}
	return _sys
}

export function statusBarHeight() {
	return sysInfo().statusBarHeight || 20
}

const bottomInset = ref(0)
const layoutHeight = ref(0)

export function refreshSafeArea() {
	try {
		const { safeAreaInsets, windowHeight } = uni.getSystemInfoSync()
		bottomInset.value = Math.max(0, Number(safeAreaInsets && safeAreaInsets.bottom) || 0)
		layoutHeight.value = Math.max(0, Number(windowHeight) || 0)
	} catch (e) {
		// Keep the last reported inset if the window is temporarily unavailable.
	}
}

export function safeBottom() {
	return bottomInset.value
}

export function currentWindowHeight() {
	return layoutHeight.value || windowHeight
}

/** 自定义顶栏总高度 = 状态栏 + 48px */
export function headerHeight() {
	return statusBarHeight() + 48
}

/** 底部导航高度 = 56px + 安全区 */
export const BOTTOM_BAR_HEIGHT = 56
export function navBarHeight() {
	return BOTTOM_BAR_HEIGHT + safeBottom()
}

/** 迷你播放器高度 */
export function miniPlayerHeight() {
	return 64
}

export function miniPlayerClearance(visible) {
	return safeBottom() + (visible ? miniPlayerHeight() : 0)
}

export const windowWidth = sysInfo().windowWidth
export const windowHeight = sysInfo().windowHeight
