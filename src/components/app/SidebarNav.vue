<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * 侧边栏条目。group 为真表示这是一个分组标题（如「业务管理」「财务」），
 * 本身不可点击，只用来给下面的子项分层。
 */
export interface NavItem {
  key: string
  label: string
  icon?: Component
  to?: RouteLocationRaw
  group?: boolean
  /**
   * 仅精确匹配时高亮。`/dashboard` 是所有子路由的前缀，
   * 默认的前缀匹配会让「主页」在每个子页面都亮着。
   */
  exact?: boolean
  children?: NavItem[]
}

const props = defineProps<{ items: NavItem[]; title: string }>()
const emit = defineEmits<{ navigate: [] }>()

const ACTIVE = 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
const BASE =
  'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-ring/50 flex items-center gap-2 rounded-md py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none'

/** 精确项把高亮交给 exact-active-class，普通项用前缀匹配。 */
function activeClass(item: NavItem) {
  return item.exact ? '' : ACTIVE
}

function exactActiveClass(item: NavItem) {
  return item.exact ? ACTIVE : ''
}
</script>

<template>
  <nav class="flex flex-col gap-1 p-3" :aria-label="props.title">
    <template v-for="item in props.items" :key="item.key">
      <!-- 分组标题 + 缩进的子项 -->
      <template v-if="item.group">
        <p class="text-muted-foreground px-3 pt-4 pb-1 text-xs font-medium">
          {{ item.label }}
        </p>
        <RouterLink
          v-for="child in item.children"
          :key="child.key"
          :to="child.to!"
          :class="[BASE, 'pr-3 pl-6']"
          :active-class="activeClass(child)"
          :exact-active-class="exactActiveClass(child)"
          @click="emit('navigate')"
        >
          <component :is="child.icon" v-if="child.icon" class="size-4 shrink-0" />
          <span class="truncate">{{ child.label }}</span>
        </RouterLink>
      </template>

      <!-- 顶层可点击项 -->
      <RouterLink
        v-else
        :to="item.to!"
        :class="[BASE, 'px-3']"
        :active-class="activeClass(item)"
        :exact-active-class="exactActiveClass(item)"
        @click="emit('navigate')"
      >
        <component :is="item.icon" v-if="item.icon" class="size-4 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </RouterLink>
    </template>
  </nav>
</template>
