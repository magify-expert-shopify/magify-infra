export const sidebarToneClasses = {
  slate: {
    itemActive: "bg-primary/10 text-primary",
    itemInactive: "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
  },
  sky: {
    itemActive: "bg-sky-500/10 text-sky-900",
    itemInactive: "text-slate-600 hover:bg-sky-50 hover:text-sky-900",
  },
  emerald: {
    itemActive: "bg-emerald-500/10 text-emerald-900",
    itemInactive: "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900",
  },
  amber: {
    itemActive: "bg-amber-500/10 text-amber-900",
    itemInactive: "text-slate-600 hover:bg-amber-50 hover:text-amber-900",
  },
  violet: {
    itemActive: "bg-violet-500/10 text-violet-900",
    itemInactive: "text-slate-600 hover:bg-violet-50 hover:text-violet-900",
  },
  rose: {
    itemActive: "bg-rose-500/10 text-rose-900",
    itemInactive: "text-slate-600 hover:bg-rose-50 hover:text-rose-900",
  },
  cyan: {
    itemActive: "bg-cyan-500/10 text-cyan-900",
    itemInactive: "text-slate-600 hover:bg-cyan-50 hover:text-cyan-900",
  },
} as const;

export type SidebarTone = keyof typeof sidebarToneClasses;
