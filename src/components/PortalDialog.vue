<script setup>
defineProps({
  visible: { type: Boolean, default: false },
})
defineEmits(['confirm'])
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="portal-dialog-backdrop">
      <div class="portal-dialog" role="dialog" aria-modal="true" aria-label="Level complete">
        <div class="portal-dialog__plate">
          <h2 class="portal-dialog__title">Portal discovered</h2>
          <p class="portal-dialog__body">Your soul remembers every step.</p>
          <p class="portal-dialog__hint">Press OK to reveal the full map.</p>
          <button type="button" class="brick-btn portal-dialog__ok" @click="$emit('confirm')">OK</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.portal-dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 99999;
  background: #000;
}

.portal-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.portal-dialog__plate {
  width: min(90vw, 520px);
  background: url('/images/plate.png') no-repeat center / 100% 100%;
  aspect-ratio: 1317 / 687;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10% 14%;
  text-align: center;
}

.portal-dialog__title {
  color: #111;
  font-size: clamp(1.1rem, 4vw, 1.8rem);
  font-weight: 700;
  margin: 0 0 0.4em;
}

.portal-dialog__body {
  color: #333;
  font-size: clamp(0.8rem, 2.5vw, 1rem);
  margin: 0 0 0.3em;
}

.portal-dialog__hint {
  color: #555;
  font-size: clamp(0.7rem, 2vw, 0.9rem);
  margin: 0 0 0.8em;
}
</style>
