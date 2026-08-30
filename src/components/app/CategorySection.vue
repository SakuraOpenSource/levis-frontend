<script setup lang="ts">
// 商店列表视图的分组分块：递归渲染任意深度的分组树。
import ProductCard from '@/components/app/ProductCard.vue'
import type { Category, Product } from '@/lib/types'

interface NavNode {
  category: Category
  path: string
  ownProducts: Product[]
  children: NavNode[]
}

defineProps<{
  node: NavNode
  adding: number | null
}>()

const emit = defineEmits<{ add: [product: Product] }>()
</script>

<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 :class="node.path ? 'text-sm font-medium' : 'text-lg font-semibold'">
        {{ node.path }}{{ node.category.name }}
      </h2>
      <p v-if="node.category.description" class="text-muted-foreground text-sm">
        {{ node.category.description }}
      </p>
    </div>

    <div v-if="node.ownProducts.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProductCard
        v-for="product in node.ownProducts"
        :key="product.id"
        :product="product"
        :pending="adding === product.id"
        @add="emit('add', product)"
      />
    </div>

    <CategorySection
      v-for="child in node.children"
      :key="child.category.id"
      :node="child"
      :adding="adding"
      @add="emit('add', $event)"
    />
  </section>
</template>
