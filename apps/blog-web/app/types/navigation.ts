export type SidebarTone =
  | "slate"
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "rose"
  | "cyan";

export type SidebarItem = {
  label: string;
  to: string;
  icon: string;
  visible?: boolean;
  tone?: SidebarTone;
};

export type SidebarGroup = {
  title?: string;
  visible?: boolean;
  tone?: SidebarTone;
  items: SidebarItem[];
};
