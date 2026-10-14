<template>
  <UApp :locale="UI_LOCALES[locale]">
    <NuxtPage />
  </UApp>
</template>

<script setup lang="ts">
import { en, zh_cn, zh_tw } from '@nuxt/ui/locale'
import { extendLocale } from '@nuxt/ui/composables'
import { useI18n } from 'vue-i18n'

// Nuxt UI's own labels and reading direction. It has no Hong Kong locale,
// so that one is Taiwan's traditional text under Hong Kong's code.
const UI_LOCALES = {
  'en': en,
  'zh-CN': zh_cn,
  'zh-HK': extendLocale(zh_tw, { name: '繁體中文（香港）', code: 'zh-HK' }),
}

const { locale, t } = useI18n<object, AppLocale>()
useHead({ htmlAttrs: { lang: locale }, title: t('app.name') })
</script>
