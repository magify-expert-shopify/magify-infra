export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'rose',
      neutral: 'slate',
    },
    button: {
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-white bg-primary hover:bg-primary/75 active:bg-primary/75 disabled:bg-primary aria-disabled:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        },
        {
          color: 'neutral',
          variant: 'solid',
          class: 'bg-slate-200 text-slate-900 hover:bg-slate-300 active:bg-slate-300 disabled:bg-slate-200 aria-disabled:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
        },
        {
          color: 'neutral',
          variant: 'outline',
          class: 'ring ring-inset ring-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-100 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        },
        {
          color: 'neutral',
          variant: 'soft',
          class: 'text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-200 focus:outline-none focus-visible:bg-slate-200 disabled:bg-slate-100 aria-disabled:bg-slate-100',
        },
        {
          color: 'neutral',
          variant: 'subtle',
          class: 'ring ring-inset ring-slate-200 text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-200 disabled:bg-slate-100 aria-disabled:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        },
      ],
    },
    badge: {
      compoundVariants: [
        {
          color: 'neutral',
          variant: 'solid',
          class: 'bg-slate-200 text-slate-900',
        },
        {
          color: 'neutral',
          variant: 'outline',
          class: 'ring ring-inset ring-slate-300 text-slate-700',
        },
        {
          color: 'neutral',
          variant: 'soft',
          class: 'bg-slate-100 text-slate-700',
        },
        {
          color: 'neutral',
          variant: 'subtle',
          class: 'bg-slate-100 text-slate-700 ring ring-inset ring-slate-200',
        },
      ],
    },
  },
})
