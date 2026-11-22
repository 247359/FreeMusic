export function touchPoint(event) {
	const touch = event.changedTouches && event.changedTouches[0]
	if (!touch) return null
	return { x: touch.clientX, y: touch.clientY, id: touch.identifier }
}

// Keep the native vertical scroll. Switch only after a clear horizontal gesture.
export function createTabSwipe(keys, current, select) {
	let startPoint = null
	let direction = ''

	function cancel() {
		startPoint = null
		direction = ''
	}

	function start(event) {
		if (event.touches && event.touches.length > 1) {
			cancel()
			return
		}
		startPoint = touchPoint(event)
		direction = ''
	}

	function move(event) {
		const point = touchPoint(event)
		if (!startPoint || !point || point.id !== startPoint.id || direction) return
		const x = Math.abs(point.x - startPoint.x)
		const y = Math.abs(point.y - startPoint.y)
		if (y > 12 && y >= x) direction = 'vertical'
		else if (x > 16 && x > y * 1.4) direction = 'horizontal'
	}

	function end(event) {
		const point = touchPoint(event)
		const origin = startPoint
		const vertical = direction === 'vertical'
		cancel()
		if (vertical || !point || !origin || point.id !== origin.id) return
		const x = point.x - origin.x
		const y = point.y - origin.y
		if (Math.abs(x) < 54 || Math.abs(x) <= Math.abs(y) * 1.4) return
		const index = keys.indexOf(current())
		const target = index + (x < 0 ? 1 : -1)
		if (index >= 0 && target >= 0 && target < keys.length) select(keys[target])
	}

	return { start, move, end, cancel }
}
