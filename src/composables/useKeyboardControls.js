// Attaches a global keydown handler bound to the component lifecycle.
import { onMounted, onBeforeUnmount } from 'vue'

export function useKeyboardControls(handler) {
  onMounted(() => {
    window.addEventListener('keydown', handler)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handler)
  })
}
