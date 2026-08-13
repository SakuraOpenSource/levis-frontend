<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

const props = withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <div class="space-y-3" aria-busy="true">
    <Skeleton v-for="row in props.rows" :key="row" class="h-12 w-full" />
  </div>
</template>
