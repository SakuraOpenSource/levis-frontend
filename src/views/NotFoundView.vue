<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
    <p class="text-muted-foreground text-6xl font-semibold tabular">404</p>
    <h1 class="text-xl font-semibold">{{ t('error.notFound') }}</h1>
    <p class="text-muted-foreground text-sm">{{ t('error.notFoundHint') }}</p>
    <Button as-child>
      <RouterLink :to="{ name: 'shop' }">{{ t('error.backHome') }}</RouterLink>
    </Button>
  </div>
</template>
