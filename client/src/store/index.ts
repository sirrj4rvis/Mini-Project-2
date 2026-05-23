import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/mock-data";

// 1. Theme State
interface ThemeState {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
}
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "pricelens-theme" },
  ),
);

// 2. UI State (Layout & Toggles)
interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
}
export const useUIStore = create<UIState>()((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  viewMode: "grid",
  setViewMode: (mode) => set({ viewMode: mode }),
}));

// 3. Comparison State
interface CompareState {
  comparisonTray: Product[];
  addToComparison: (product: Product) => void;
  removeFromComparison: (productId: string) => void;
  clearComparison: () => void;
}
export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      comparisonTray: [],
      addToComparison: (product) =>
        set((state) => {
          if (state.comparisonTray.length >= 3) return state; // Max 3 items
          if (state.comparisonTray.find((p) => p.id === product.id)) return state;
          return { comparisonTray: [...state.comparisonTray, product] };
        }),
      removeFromComparison: (productId) =>
        set((state) => ({
          comparisonTray: state.comparisonTray.filter((p) => p.id !== productId),
        })),
      clearComparison: () => set({ comparisonTray: [] }),
    }),
    { name: "pricelens-compare" },
  ),
);

// 4. Search State
interface SearchState {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  savedFilters: Record<string, any>;
  setSavedFilters: (filters: Record<string, any>) => void;
}
export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecentSearch: (query) =>
        set((state) => {
          if (!query.trim()) return state;
          const filtered = state.recentSearches.filter((q) => q !== query);
          return { recentSearches: [query, ...filtered].slice(0, 5) };
        }),
      clearRecentSearches: () => set({ recentSearches: [] }),
      savedFilters: {},
      setSavedFilters: (filters) => set({ savedFilters: filters }),
    }),
    { name: "pricelens-search" },
  ),
);

// 5. Analytics State
interface AnalyticsState {
  timeRange: "14D" | "30D" | "60D";
  setTimeRange: (range: "14D" | "30D" | "60D") => void;
}
export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      timeRange: "60D",
      setTimeRange: (timeRange) => set({ timeRange }),
    }),
    { name: "pricelens-analytics" },
  ),
);
