/** 根据当前秒数二分查找歌词行索引 */
export function lyricIndexAt(lines, time) {
	if (!lines || !lines.length || lines[0].time < 0) return -1
	let low = 0
	let high = lines.length - 1
	let ans = -1
	while (low <= high) {
		const mid = (low + high) >> 1
		if (lines[mid].time <= time + 0.12) {
			ans = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	return ans
}

export function lyricPreviewRows(lines, index) {
	const center = lines[0]?.time < 0 ? 0 : index
	return lines.slice(Math.max(0, center - 2), center + 3).map((line, offset) => {
		const lineIndex = Math.max(0, center - 2) + offset
		return { index: lineIndex, content: line.content, position: lineIndex - center }
	})
}

function comparableText(value) {
	return String(value || '').trim().toLowerCase()
}

function lyricTitle(value) {
	return comparableText(value).replace(/\s*[(（][^()（）]*[)）]\s*$/, '')
}

function readLyricTrack(track) {
	const offset = Number(track.offset) || 0
	const lines = Array.isArray(track.line) ? track.line : []
	const parsed = lines.filter(Boolean).map((line) => {
		const start = line.start == null || line.start === '' ? NaN : Number(line.start)
		const time = track.synced !== false && Number.isFinite(start) ? Math.max(0, start - offset) / 1000 : -1
		return { time, content: String(line.value ?? line.content ?? '').trim() }
	})
	const timed = parsed.filter((line) => line.time >= 0)
	return timed.length ? timed.sort((a, b) => a.time - b.time) : parsed.filter((line) => line.content)
}

/** Choose one main lyric track. Alternate originals are never shown as translations. */
export function structuredLyrics(list, song) {
	const tracks = (Array.isArray(list) ? list : []).filter(Boolean).map((track) => ({
		track, lines: readLyricTrack(track)
	})).filter((entry) => entry.lines.some((line) => line.content))
	const title = lyricTitle(song.name)
	const artist = comparableText(song.artistName)
	const knownArtist = artist && !/^\[?unknown artist\]?$/.test(artist) && artist !== '未知歌手'
	const score = ({ track, lines }) => {
		const exactTitle = title && lyricTitle(track.displayTitle) === title
		const exactArtist = artist && comparableText(track.displayArtist) === artist
		return (exactTitle ? 4 : 0) + (exactArtist ? 2 : 0) + (lines[0].time >= 0 ? 1 : 0)
	}
	const main = tracks
		.filter(({ track }) => !track.kind || track.kind === 'main')
		.sort((a, b) => score(b) - score(a))[0]
	if (main && title && knownArtist) {
		const sourceTitle = lyricTitle(main.track.displayTitle)
		const sourceArtist = comparableText(main.track.displayArtist)
		if (sourceTitle && sourceArtist && sourceTitle !== title && sourceArtist !== artist) {
			return { lyric: [], tlyric: [], mismatch: true }
		}
	}
	const translation = tracks.find(({ track, lines }) => track.kind === 'translation' && lines[0].time >= 0)
	return { lyric: main ? main.lines : [], tlyric: main && translation ? translation.lines : [] }
}
