import {
  Search,
  SlidersHorizontal,
  DraftingCompass,
  ListChecks,
  Database,
  Ruler,
  BookOpen,
  Weight,
  Wind,
  Activity,
  Grid2x2,
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
    | "designManagement"
    | "partAssembly"
    | "partData"
    | "partDrawing"
    | "catalog"
    | "weightCalc"
    | "ventilationCalc"
    | "seismicCalc"
    | "otherCalc"
    | "import"
    | "trash"
    | "settings";
  href: string;
  icon: LucideIcon;
}

/**
 * 母線銅帯/接地線/アースバー have no sidebar entry of their own — they live as
 * tabs inside 他計算 (`/calculations/other?module=busbar|earth-wire|earth-bar`)
 * per explicit request, rather than as separate top-level pages. Their old
 * dedicated routes still exist but only to redirect into 他計算 (see
 * `src/app/calculations/{busbar,earth-wire,earth-bar}/page.tsx`) so any
 * existing bookmark or search-provider deep link still lands somewhere
 * useful.
 */
export const navItems: NavItem[] = [
  { key: "search", href: "/search", icon: Search },
  { key: "selection", href: "/selection", icon: SlidersHorizontal },
  { key: "designManagement", href: "/design", icon: DraftingCompass },
  { key: "partAssembly", href: "/part-assembly", icon: ListChecks },
  { key: "partData", href: "/part-data", icon: Database },
  { key: "partDrawing", href: "/part-drawing", icon: Ruler },
  { key: "catalog", href: "/catalog", icon: BookOpen },
  { key: "weightCalc", href: "/calculations/weight", icon: Weight },
  { key: "ventilationCalc", href: "/calculations/ventilation", icon: Wind },
  { key: "seismicCalc", href: "/calculations/seismic", icon: Activity },
  { key: "otherCalc", href: "/calculations/other", icon: Grid2x2 },
  { key: "import", href: "/import", icon: FolderInput },
  { key: "trash", href: "/trash", icon: Trash2 },
  { key: "settings", href: "/settings", icon: Settings },
];
