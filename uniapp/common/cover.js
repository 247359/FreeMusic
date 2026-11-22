const repairs = new Map()
const maxCoverBytes = 512 * 1024

export function repairCover(url) {
	if (repairs.has(url)) return repairs.get(url)
	const repair = new Promise((resolve) => {
		uni.request({
			url,
			responseType: 'arraybuffer',
			timeout: 5000,
			success(result) {
				const data = result.data
				if (result.statusCode !== 200 || !data || data.byteLength > maxCoverBytes) {
					resolve('')
					return
				}
				const bytes = new Uint8Array(data)
				let offset = 0
				while (offset < 16 && bytes[offset] === 0) offset++
				if (bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8 || bytes[offset + 2] !== 0xff) {
					resolve('')
					return
				}
				resolve('data:image/jpeg;base64,' + uni.arrayBufferToBase64(data.slice(offset)))
			},
			fail() {
				resolve('')
			}
		})
	})
	repairs.set(url, repair)
	if (repairs.size > 16) repairs.delete(repairs.keys().next().value)
	return repair
}
