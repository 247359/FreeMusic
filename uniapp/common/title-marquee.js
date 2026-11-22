import { computed, nextTick, ref } from 'vue'

export function useTitleMarquee(trackTitle, viewportSelector, textSelector) {
	const titleWidth = ref(0)
	const titleGap = 32
	const titleMoving = ref(false)
	const titleTravel = computed(() => titleWidth.value + titleGap)
	const titleDuration = computed(() => Math.round(titleTravel.value / 34 * 1000))
	const titleStripStyle = computed(() => ({
		width: titleWidth.value ? (titleWidth.value * 2 + titleGap) + 'px' : '100%',
		transform: 'translateX(' + (titleMoving.value ? -titleTravel.value : 0) + 'px)',
		transitionDuration: (titleMoving.value ? titleDuration.value : 0) + 'ms'
	}))
	let titleTimer = null
	let titleLayoutId = 0
	let visible = false

	function stopTitleMarquee() {
		titleLayoutId++
		clearTimeout(titleTimer)
		titleTimer = null
		titleMoving.value = false
		titleWidth.value = 0
	}

	function startTitleMarquee() {
		titleTimer = setTimeout(() => {
			titleMoving.value = true
			titleTimer = setTimeout(() => {
				titleMoving.value = false
				startTitleMarquee()
			}, titleDuration.value)
		}, 900)
	}

	async function refreshTitleMarquee() {
		stopTitleMarquee()
		if (!visible || !trackTitle.value) return
		const layoutId = titleLayoutId
		await nextTick()
		if (layoutId !== titleLayoutId) return
		const [viewport, title] = await new Promise((resolve) => {
			const query = uni.createSelectorQuery()
			query.select(viewportSelector).boundingClientRect()
			query.select(textSelector).boundingClientRect()
			query.exec(resolve)
		})
		if (layoutId !== titleLayoutId) return
		const viewportWidth = viewport?.width || 0
		const textWidth = title?.width || 0
		if (!viewportWidth || textWidth <= viewportWidth) return

		titleWidth.value = Math.ceil(textWidth) + 1
		startTitleMarquee()
	}

	function setTitleMarqueeVisible(active) {
		visible = active
		if (active) refreshTitleMarquee()
		else stopTitleMarquee()
	}

	return { titleWidth, titleGap, titleStripStyle, refreshTitleMarquee, stopTitleMarquee, setTitleMarqueeVisible }
}
