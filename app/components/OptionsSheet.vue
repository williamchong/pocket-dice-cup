<template>
  <section
    class="options"
    :aria-label="$t('options.label')"
  >
    <USwitch
      :model-value="soundOn"
      :label="$t('options.sound')"
      @update:model-value="emit('update:soundOn', $event)"
    />
    <!-- Only where there is an island to keep the roll in: the iPhone app on iOS 17 or later. -->
    <USwitch
      v-if="islandSupported"
      :model-value="islandOn"
      :label="$t('options.island')"
      :description="$t('options.islandNote')"
      @update:model-value="emit('update:islandOn', $event)"
    />
    <div class="options__buttons">
      <UButton
        class="min-h-11"
        :label="$t('sheet.done')"
        @click="emit('close')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  soundOn: boolean
  islandOn: boolean
  islandSupported: boolean
}>()

const emit = defineEmits<{ 'update:soundOn': [on: boolean], 'update:islandOn': [on: boolean], 'close': [] }>()
</script>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.options__buttons {
  display: flex;
  justify-content: flex-end;
}
</style>
