<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'

import { Alert, AlertDescription } from '@/components/ui/alert'

defineProps<{ message?: string | null }>()
</script>

<template>
  <Alert v-if="message" variant="destructive" aria-live="polite">
    <AlertCircle />
    <AlertDescription>{{ message }}</AlertDescription>
  </Alert>
</template>
