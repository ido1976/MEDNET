import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SharedListsState {
  settlements: string[];
  cities: string[];
  categories: Record<string, string[]>; // screen -> categories
  stores: string[];
  initialized: boolean;
  initialize: () => Promise<void>;
  addSettlement: (name: string) => void;
  addCity: (name: string) => void;
  addCategory: (screen: string, category: string) => void;
  addStore: (name: string) => void;
}

const DEFAULT_SETTLEMENTS = [
  'צפת', 'ראש פינה', 'חצור הגלילית', 'עמוקה', 'מירון', 'כנען',
  'ביריה', 'עין זיתים', 'דלתון', 'אלמגור', 'כפר חנניה', 'פרוד',
  'גוש חלב', 'עמירים', 'לבנים', 'חוקוק', 'כפר שמאי', 'בר יוחאי',
];

const DEFAULT_CITIES = [
  'צפת', 'חיפה', 'תל אביב', 'ירושלים', 'טבריה', 'כרמיאל',
  'עכו', 'נהריה', 'ראש פינה', 'קריות', 'עפולה', 'נצרת',
  'חצור הגלילית', 'מירון', 'כנען', 'באר שבע',
];

const DEFAULT_STORES = ['סופר דוש', 'רמי לוי', 'שופרסל', 'AM:PM', 'מכולת שכונתית'];

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  bridges: ['כללי', 'לימודים', 'מחקר', 'קליניקה', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'],
  discussions: ['כללי', 'לימודים', 'מחקר', 'קליניקה', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'],
  events: ['כללי', 'לימודים', 'חברתי', 'ספורט', 'תרבות', 'התנדבות', 'מסיבות', 'הרצאות'],
  prices: ['מזון', 'תחבורה', 'בילויים', 'ציוד לימודי', 'שירותים'],
};

const STORAGE_KEY = 'mednet_shared_lists';

export const useSharedListsStore = create<SharedListsState>((set, get) => ({
  settlements: DEFAULT_SETTLEMENTS,
  cities: DEFAULT_CITIES,
  categories: DEFAULT_CATEGORIES,
  stores: DEFAULT_STORES,
  initialized: false,

  initialize: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        set({
          settlements: data.settlements || DEFAULT_SETTLEMENTS,
          cities: data.cities || DEFAULT_CITIES,
          categories: { ...DEFAULT_CATEGORIES, ...data.categories },
          stores: data.stores || DEFAULT_STORES,
          initialized: true,
        });
      } else {
        set({ initialized: true });
      }
    } catch (e) {
      set({ initialized: true });
    }
  },

  addSettlement: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.settlements.includes(trimmed)) return state;
      const updated = [...state.settlements, trimmed];
      _save({ ...state, settlements: updated });
      return { settlements: updated };
    });
  },

  addCity: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.cities.includes(trimmed)) return state;
      const updated = [...state.cities, trimmed];
      _save({ ...state, cities: updated });
      return { cities: updated };
    });
  },

  addCategory: (screen, category) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    set((state) => {
      const existing = state.categories[screen] || [];
      if (existing.includes(trimmed)) return state;
      const updated = { ...state.categories, [screen]: [...existing, trimmed] };
      _save({ ...state, categories: updated });
      return { categories: updated };
    });
  },

  addStore: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.stores.includes(trimmed)) return state;
      const updated = [...state.stores, trimmed];
      _save({ ...state, stores: updated });
      return { stores: updated };
    });
  },
}));

function _save(state: any) {
  try {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      settlements: state.settlements,
      cities: state.cities,
      categories: state.categories,
      stores: state.stores,
    }));
  } catch (e) {}
}
