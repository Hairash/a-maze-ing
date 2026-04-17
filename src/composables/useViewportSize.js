// Reactive viewport dimensions. Updates on window resize and orientation change.
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useViewportSize() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

  function update() {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  onMounted(() => {
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    update()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
  })

  return { width, height }
}
