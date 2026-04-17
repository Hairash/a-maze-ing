// Fires `fired.value = true` once `delayMs` has elapsed without scroll
// or pointer activity. Only armed while `enabledRef` is truthy. Resets
// the timer on every observed activity.
import { ref, watch, onBeforeUnmount } from 'vue'

export function useInactivityTimer({ delayMs, enabledRef }) {
  const fired = ref(false)
  let timerId = null

  function reset() {
    fired.value = false
    if (timerId !== null) window.clearTimeout(timerId)
    timerId = window.setTimeout(() => {
      fired.value = true
    }, delayMs)
  }

  function teardown() {
    fired.value = false
    if (timerId !== null) {
      window.clearTimeout(timerId)
      timerId = null
    }
    document.body.removeEventListener('scroll', reset)
    window.removeEventListener('pointerdown', reset)
  }

  watch(
    enabledRef,
    (val) => {
      if (val) {
        reset()
        document.body.addEventListener('scroll', reset, { passive: true })
        window.addEventListener('pointerdown', reset)
      } else {
        teardown()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(teardown)

  return { fired }
}
