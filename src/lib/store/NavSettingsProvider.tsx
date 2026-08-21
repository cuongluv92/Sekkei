"use client";

import {
  Bookmark,
  Flag,
  FolderOpen,
  Layers,
  Link2,
  Star,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { navItems, type NavItem } from "@/lib/nav";
import { useTranslation } from "@/lib/i18n";

/** Small fixed icon set for user-created menu items (kept separate from the built-in nav icons). */
export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  folder: FolderOpen,
  star: Star,
  bookmark: Bookmark,
  tag: Tag,
  flag: Flag,
  layers: Layers,
  link: Link2,
};

export interface CustomNavItem {
  id: string;
  label: string;
  icon: keyof typeof CUSTOM_ICONS;
}

interface NavSettingsState {
  hiddenKeys: string[];
  labelOverrides: Record<string, string>;
  customItems: CustomNavItem[];
  order: string[];
}

export interface NavEntry {
  id: string;
  label: string;
  Icon: LucideIcon;
  href: string;
  isCustom: boolean;
  hidden: boolean;
}

const STORAGE_KEY = "sekkei.navSettings";

const DEFAULT_STATE: NavSettingsState = {
  hiddenKeys: [],
  labelOverrides: {},
  customItems: [],
  order: navItems.map((i) => i.key),
};

interface NavSettingsContextValue {
  /** All entries (built-in + custom), in display order, including hidden ones. Used by 設定 > メニュー管理. */
  allEntries: NavEntry[];
  /** Only the entries the sidebar should render. */
  visibleEntries: NavEntry[];
  renameItem: (id: string, label: string) => void;
  toggleHidden: (key: string) => void;
  addCustomItem: (label: string, icon: keyof typeof CUSTOM_ICONS) => void;
  removeCustomItem: (id: string) => void;
  moveItem: (id: string, direction: "up" | "down") => void;
}

const NavSettingsContext = createContext<NavSettingsContextValue | null>(null);

let customIdCounter = 0;
function nextCustomId() {
  customIdCounter += 1;
  return `custom-${Date.now()}-${customIdCounter}`;
}

export function NavSettingsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<NavSettingsState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch {
      // ignore malformed/unavailable storage, fall back to defaults
    }
  }, []);

  const persist = useCallback((next: NavSettingsState) => {
    setState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const renameItem = useCallback(
    (id: string, label: string) => {
      const isCustom = state.customItems.some((c) => c.id === id);
      if (isCustom) {
        persist({
          ...state,
          customItems: state.customItems.map((c) => (c.id === id ? { ...c, label } : c)),
        });
      } else {
        persist({ ...state, labelOverrides: { ...state.labelOverrides, [id]: label } });
      }
    },
    [state, persist],
  );

  const toggleHidden = useCallback(
    (key: string) => {
      const hidden = state.hiddenKeys.includes(key)
        ? state.hiddenKeys.filter((k) => k !== key)
        : [...state.hiddenKeys, key];
      persist({ ...state, hiddenKeys: hidden });
    },
    [state, persist],
  );

  const addCustomItem = useCallback(
    (label: string, icon: keyof typeof CUSTOM_ICONS) => {
      const id = nextCustomId();
      persist({
        ...state,
        customItems: [...state.customItems, { id, label, icon }],
        order: [...state.order, id],
      });
    },
    [state, persist],
  );

  const removeCustomItem = useCallback(
    (id: string) => {
      persist({
        ...state,
        customItems: state.customItems.filter((c) => c.id !== id),
        order: state.order.filter((o) => o !== id),
      });
    },
    [state, persist],
  );

  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      const order = [...fullOrder(state)];
      const index = order.indexOf(id);
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= order.length) return;
      [order[index], order[swapWith]] = [order[swapWith], order[index]];
      persist({ ...state, order });
    },
    [state, persist],
  );

  const allEntries = useMemo(() => buildEntries(state, navItems, t), [state, t]);
  const visibleEntries = useMemo(() => allEntries.filter((e) => !e.hidden), [allEntries]);

  const value: NavSettingsContextValue = {
    allEntries,
    visibleEntries,
    renameItem,
    toggleHidden,
    addCustomItem,
    removeCustomItem,
    moveItem,
  };

  return <NavSettingsContext.Provider value={value}>{children}</NavSettingsContext.Provider>;
}

/** Ensures every built-in/custom id is present in `order`, appending any missing ones at the end. */
function fullOrder(state: NavSettingsState): string[] {
  const known = new Set(state.order);
  const missing = [
    ...navItems.map((i) => i.key),
    ...state.customItems.map((c) => c.id),
  ].filter((id) => !known.has(id));
  return [...state.order, ...missing];
}

function buildEntries(
  state: NavSettingsState,
  builtIns: NavItem[],
  t: (path: string) => string,
): NavEntry[] {
  const byId = new Map<string, NavEntry>();

  for (const item of builtIns) {
    byId.set(item.key, {
      id: item.key,
      label: state.labelOverrides[item.key] ?? t(`nav.${item.key}`),
      Icon: item.icon,
      href: item.href,
      isCustom: false,
      hidden: state.hiddenKeys.includes(item.key),
    });
  }

  for (const item of state.customItems) {
    byId.set(item.id, {
      id: item.id,
      label: item.label,
      Icon: CUSTOM_ICONS[item.icon] ?? Link2,
      href: `/custom/${item.id}`,
      isCustom: true,
      hidden: false,
    });
  }

  const order = fullOrder(state);
  return order.map((id) => byId.get(id)).filter((e): e is NavEntry => Boolean(e));
}

export function useNavSettings() {
  const ctx = useContext(NavSettingsContext);
  if (!ctx) throw new Error("useNavSettings must be used within a NavSettingsProvider");
  return ctx;
}
