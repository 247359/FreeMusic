/** 页面跳转与「播放整个列表」的公共动作 */

import * as api from './api.js'
import { enqueueTrack, setQueue } from './player.js'
import { toast, fmtTime, fmtBitrate } from './format.js'
import { isLiked, getRating, setLocalRating } from './store.js'

const ROUTES = {
	album: '/pages/album/album?id=',
	playlist: '/pages/playlist/playlist?id=',
	artist: '/pages/artist/artist?id='
}

export function goDetail(type, item) {
	if (!item || !item.id) return
	let url = (ROUTES[type] || ROUTES.album) + encodeURIComponent(item.id)
	if (item.name && type === 'playlist') {
		url += '&name=' + encodeURIComponent(item.name)
	}
	uni.navigateTo({ url })
}

/** 打开分类列表页：type = album | artist | playlist */
export function goList(type, listType, title) {
	let url = '/pages/daily/daily?from=' + encodeURIComponent(type)
	if (listType) url += '&listType=' + encodeURIComponent(listType)
	if (title) url += '&title=' + encodeURIComponent(title)
	uni.navigateTo({ url })
}

export function openSearch() {
	uni.navigateTo({ url: '/pages/search/search' })
}

export function goSettings() {
	uni.navigateTo({ url: '/pages/settings/settings' })
}

export function goFavorites() {
	uni.navigateTo({ url: '/pages/favorites/favorites' })
}

/** 曲目右侧「更多」菜单：喜欢 / 加入歌单 / 下一首播放 */
export function showTrackMenu(track) {
	if (!track) return
	const liked = isLiked(track.id)
	uni.showActionSheet({
		itemList: [
			liked ? '取消喜欢' : '添加到我喜欢的音乐',
			'添加到歌单',
			'下一首播放',
			'评分 (' + (getRating(track.id) || '未评') + ')',
			'歌曲信息',
			'加入队列末尾'
		],
		success(res) {
			const index = res.tapIndex
			if (index === 3) {
				rateTrack(track)
				return
			}
			if (index === 4) {
				showSongInfoModal(track)
				return
			}
			if (index === 0) {
				api
					.likeTrack(track, !liked)
					.then(() => toast(liked ? '已取消喜欢' : '已添加到我喜欢的音乐'))
					.catch((e) => toast(e.message || '操作失败'))
			} else if (index === 1) {
				choosePlaylistForTracks([track])
			} else if (index === 2) {
				enqueueTrack(track, true)
			} else if (index === 5) {
				enqueueTrack(track)
			}
		}
	})
}

let selectionTracks = []

export function openTrackSelection(tracks) {
	selectionTracks = tracks.slice()
	uni.navigateTo({
		url: '/pages/track-selection/track-selection',
		fail() {
			selectionTracks = []
			toast('无法打开多选页面')
		}
	})
}

export function takeTrackSelection() {
	const tracks = selectionTracks
	selectionTracks = []
	return tracks
}

export function choosePlaylistForTracks(tracks) {
	const ids = [...new Set(tracks.map((track) => track.id).filter(Boolean))]
	if (!ids.length) return
	api.getPlaylists()
		.then((list) => pickPlaylist(list || [], ids))
		.catch((e) => toast(e.message || '加载歌单失败'))
}

function pickPlaylist(playlists, ids, offset = 0) {
	const pageSize = 4
	const options = [{ label: '＋ 新建歌单', create: true }, ...playlists.slice(offset, offset + pageSize).map((playlist) => ({ label: '♫  ' + playlist.name, playlist }))]
	if (offset > 0) options.push({ label: '上一页歌单', offset: offset - pageSize })
	if (offset + pageSize < playlists.length) options.push({ label: '下一页歌单', offset: offset + pageSize })
	uni.showActionSheet({
		itemList: options.map((option) => option.label),
		success(result) {
			const chosen = options[result.tapIndex]
			if (!chosen) return
			if (chosen.create) {
				createPlaylistForTracks(ids)
				return
			}
			if (!chosen.playlist) {
				pickPlaylist(playlists, ids, chosen.offset)
				return
			}
			api.addToPlaylist(chosen.playlist.id, ids)
				.then(() => toast('已添加到「' + chosen.playlist.name + '」'))
				.catch((e) => toast(e.message || '添加失败'))
		}
	})
}

function createPlaylistForTracks(ids) {
	uni.showModal({
		title: '新建歌单',
		editable: true,
		placeholderText: '输入歌单名称',
		confirmText: '创建',
		success(result) {
			if (!result.confirm) return
			const name = String(result.content || '').trim()
			if (!name) {
				toast('请输入歌单名称')
				return
			}
			api.createPlaylist(name, ids)
				.then(() => toast('已创建并添加到「' + name + '」'))
				.catch((e) => toast(e.message || '创建歌单失败'))
		}
	})
}

/** 二级菜单：设置星级（1-5，或清除） */
export function rateTrack(track) {
	if (!track) return
	const current = getRating(track.id)
	uni.showActionSheet({
		itemList: ['5 星', '4 星', '3 星', '2 星', '1 星', '清除评分'],
		success(r) {
			const stars = [5, 4, 3, 2, 1]
			const value = r.tapIndex === 5 ? 0 : stars[r.tapIndex]
			setLocalRating(track.id, value)
			api
				.setRating(track.id, value)
				.then(() => toast(value > 0 ? '已评 ' + value + ' 星' : '已清除评分'))
				.catch((e) => toast(e.message || '评分保存失败'))
		}
	})
}

let songInfoRequestId = 0

/** 展示歌曲技术信息（格式/码率/大小等） */
export function showSongInfoModal(track) {
	if (!track) return
	const requestId = ++songInfoRequestId
	api
		.getSong(track.id)
		.then((full) => {
			if (requestId !== songInfoRequestId) return
			const t = full || track
			const e = t.extra || {}
			const fmt = (e.suffix || '').toUpperCase() || '未知'
			const bits = []
			if (e.bitDepth) bits.push(e.bitDepth + 'bit')
			if (e.sampleRate) bits.push((e.sampleRate / 1000).toFixed(1) + 'kHz')
			const rate = fmtBitrate(t)
			const size = e.size
				? e.size > 1024 * 1024
					? (e.size / 1024 / 1024).toFixed(1) + ' MB'
					: (e.size / 1024).toFixed(0) + ' KB'
				: '-'
			const lines = [
				'格式：' + (bits.length ? fmt + ' · ' + bits.join(' · ') : fmt),
				'源文件码率：' + rate,
				'时长：' + fmtTime(t.duration || 0),
				'大小：' + size,
				'播放次数：' + (e.playCount || 0)
			]
			uni.openDialogPage({
				url: '/pages/song-info/song-info?title=' + encodeURIComponent(t.name || '歌曲信息') +
					'&content=' + encodeURIComponent(lines.join('\n')),
				fail: () => toast('无法打开歌曲信息')
			})
		})
		.catch(() => {
			if (requestId === songInfoRequestId) toast('信息加载失败')
		})
}

export function playCollection(type, id, meta = {}) {
	if (!id) return Promise.resolve()
	let promise
	if (type === 'album') promise = api.getAlbumDetail(id)
	else if (type === 'playlist') promise = api.getPlaylistDetail(id)
	else promise = api.getArtistDetail(id)

	return promise
		.then((data) => {
			const tracks = data.tracks || []
			if (!tracks.length) {
				toast('这个列表还没有歌曲')
				return
			}
			const source = data.album || data.playlist || data.artist || {}
			setQueue(tracks, 0, {
				name: source.name || meta.name || '',
				id: String(id),
				type,
				isFM: false
			})
		})
		.catch((e) => toast(e.message || '加载失败'))
}
