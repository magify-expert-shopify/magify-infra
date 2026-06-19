import { getStableVariantFromSeed } from "~/utils/stable-variant";

export type ClusterColorVariant = {
  card: string;
  icon: string;
  badge: string;
};

export const CLUSTER_COLOR_VARIANTS: ClusterColorVariant[] = [
  {
    card: "border-sky-100",
    icon: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100",
  },
  {
    card: "border-emerald-100",
    icon: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  },
  {
    card: "border-amber-100",
    icon: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
  },
  {
    card: "border-rose-100",
    icon: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
  },
  {
    card: "border-violet-100",
    icon: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100",
  },
  {
    card: "border-cyan-100",
    icon: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-100",
    badge: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-100",
  },
  {
    card: "border-teal-100",
    icon: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
  },
  {
    card: "border-lime-100",
    icon: "bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-100",
    badge: "bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-100",
  },
  {
    card: "border-orange-100",
    icon: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100",
  },
  {
    card: "border-pink-100",
    icon: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-100",
    badge: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-100",
  },
  {
    card: "border-indigo-100",
    icon: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100",
  },
  {
    card: "border-blue-100",
    icon: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
  },
  {
    card: "border-fuchsia-100",
    icon: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-100",
    badge: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-100",
  },
  {
    card: "border-green-100",
    icon: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-100",
    badge: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-100",
  },
  {
    card: "border-red-100",
    icon: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100",
  },
];

export function getClusterColorVariant(clusterId: string) {
  return getStableVariantFromSeed(clusterId, CLUSTER_COLOR_VARIANTS);
}
