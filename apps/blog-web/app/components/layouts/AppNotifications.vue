<template>
  <div ref="root" class="relative">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-bell"
      size="sm"
      aria-label="Notifications"
      class="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
    >
      <span
        class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
      >
        0
      </span>
    </UButton>
  </div>
</template>
