import { useState, useCallback } from 'react';

const STORAGE_KEY = 'boundaries-budget';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

export type Month = typeof MONTHS[number];

export interface LocationBudgets {
  littleelm: number;
  prosper: number;
}

export type BudgetData = Record<Month, LocationBudgets>;

const DEFAULT_BUDGETS: BudgetData = {
  january:   { littleelm: 95000,  prosper: 85000 },
  february:  { littleelm: 92000,  prosper: 83000 },
  march:     { littleelm: 100000, prosper: 90000 },
  april:     { littleelm: 98000,  prosper: 88000 },
  may:       { littleelm: 105000, prosper: 95000 },
  june:      { littleelm: 110000, prosper: 100000 },
  july:      { littleelm: 108000, prosper: 98000 },
  august:    { littleelm: 105000, prosper: 95000 },
  september: { littleelm: 100000, prosper: 90000 },
  october:   { littleelm: 98000,  prosper: 88000 },
  november:  { littleelm: 102000, prosper: 92000 },
  december:  { littleelm: 110000, prosper: 100000 },
};

function loadBudgets(): BudgetData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_BUDGETS };
}

function saveBudgets(budgets: BudgetData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
}

export function useBudgetData() {
  const [budgets, setBudgets] = useState<BudgetData>(loadBudgets);

  const updateBudget = useCallback((month: Month, location: 'littleelm' | 'prosper', value: number) => {
    setBudgets(prev => {
      const next = {
        ...prev,
        [month]: { ...prev[month], [location]: value },
      };
      saveBudgets(next);
      return next;
    });
  }, []);

  const getBudgetForMonth = useCallback((month: Month, locationFilter?: 'littleelm' | 'prosper') => {
    const monthData = budgets[month];
    if (!monthData) return 0;
    if (locationFilter) return monthData[locationFilter];
    return monthData.littleelm + monthData.prosper;
  }, [budgets]);

  return { budgets, updateBudget, getBudgetForMonth, MONTHS };
}
