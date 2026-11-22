const supportedAbis = ['arm64-v8a', 'armeabi-v7a', 'x86_64']
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/

export function validReleaseRepository(repository) {
	return typeof repository === 'string' && repositoryPattern.test(repository)
}

export function selectReleaseUpdate(release, installed) {
	if (!validReleaseRepository(installed.repository) || !supportedAbis.includes(installed.abi)) {
		throw new Error('此安装包未配置 GitHub 更新源')
	}
	const current = versionPattern.exec(installed.version)
	const next = versionPattern.exec(release?.tag_name)
	if (!current || !next || release.draft || release.prerelease) {
		throw new Error('无法读取正式发布版本')
	}
	for (let index = 1; index <= 3; index++) {
		const difference = Number(next[index]) - Number(current[index])
		if (difference < 0) return null
		if (difference > 0) {
			const fileName = 'FreeMusic-' + installed.abi + '.apk'
			const expected = 'https://github.com/' + installed.repository +
				'/releases/download/' + release.tag_name + '/' + fileName
			const apk = (release.assets || []).find((asset) =>
				asset.name === fileName && asset.browser_download_url === expected)
			return { version: release.tag_name, url: apk?.browser_download_url || '' }
		}
	}
	return null
}
