<template>
  <div class="app-shell min-h-screen w-full overflow-x-clip bg-background">
    <NuxtRouteAnnouncer />
    <LayoutAppAnnouncementBar />
    <LayoutAppTopHeader />
    <LayoutAppSidebar />
    <div class="relative flex min-h-screen min-w-0 flex-1 flex-col pt-28 lg:pl-[200px]">
      <NuxtPage />
    </div>
  </div>
</template>
