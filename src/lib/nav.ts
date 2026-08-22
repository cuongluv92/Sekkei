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
  Zap,
  ArrowDownToLine,
  Rows3,
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
    | "busbarCalc"
    | "earthWireCalc"
    | "earthBarCalc"
    | "otherCalc"
    | "import"
    | "trash"
    | "settings";
  href: string;
  icon: LucideIcon;
}

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
  { key: "busbarCalc", href: "/calculations/busbar", icon: Zap },
  {
    key: "earthWireCalc",
    href: "/calculations/earth-wire",
    icon: ArrowDownToLine,
  },
  { key: "earthBarCalc", href: "/calculations/earth-bar", icon: Rows3 },
  { key: "otherCalc", href: "/calculations/other", icon: Grid2x2 },
  { key: "import", href: "/import", icon: FolderInput },
  { key: "trash", href: "/trash", icon: Trash2 },
  { key: "settings", href: "/settings", icon: Settings },
];
