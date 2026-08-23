import {
  Search,
  SlidersHorizontal,
  Zap,
  DraftingCompass,
  ListChecks,
  Database,
  Ruler,
  BookOpen,
  Weight,
  Wind,
  Activity,
  FolderInput,
  Trash2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Matches a key under `nav` in the locale dictionaries. */
  key:
    | "search"
    | "selection"
    | "electricalTools"
    | "designManagement"
    | "partAssembly"
    | "partData"
    | "partDrawing"
    | "catalog"
    | "weightCalc"
    | "ventilationCalc"
    | "seismicCalc"
    | "import"
    | "trash"
    | "settings";
  href: string;
  icon: LucideIcon;
}

/**
 * 母線銅帯/接地線/アースバー have no sidebar entry of their own — they live as
 * categories inside 電気技術計算 (`/electrical-tools?category=busbar|
 * earthWire|earthBar`) per explicit request, rather than as separate
 * top-level pages or the old standalone 他計算 hub (removed). Their old
 * dedicated routes still exist but only to redirect into 電気技術計算 (see
 * `src/app/calculations/{busbar,earth-wire,earth-bar}/page.tsx`) so any
 * existing bookmark or search-provider deep link still lands somewhere
 * useful.
 */
export const navItems: NavItem[] = [
  { key: "search", href: "/search", icon: Search },
  { key: "selection", href: "/selection", icon: SlidersHorizontal },
  { key: "electricalTools", href: "/electrical-tools", icon: Zap },
  { key: "designManagement", href: "/design", icon: DraftingCompass },
  { key: "partAssembly", href: "/part-assembly", icon: ListChecks },
  { key: "partData", href: "/part-data", icon: Database },
  { key: "partDrawing", href: "/part-drawing", icon: Ruler },
  { key: "catalog", href: "/catalog", icon: BookOpen },
  { key: "weightCalc", href: "/calculations/weight", icon: Weight },
  { key: "ventilationCalc", href: "/calculations/ventilation", icon: Wind },
  { key: "seismicCalc", href: "/calculations/seismic", icon: Activity },
  { key: "import", href: "/import", icon: FolderInput },
  { key: "trash", href: "/trash", icon: Trash2 },
  { key: "settings", href: "/settings", icon: Settings },
];
