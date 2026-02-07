
import { RevenueMetrics, OperationalMetrics, LaborMetrics, ExperienceMetrics, ShiftLeadData, RevenueMix } from './types';

export const REVENUE_DATA: Record<string, RevenueMetrics> = {
  Today: {
    netRevenue: { value: 4250, change: 8.5 },
    sssg: { value: 12.4, change: 2.1 },
    guestCount: { value: 485, change: -1.2 },
    avgTicket: { value: 8.76, change: 5.4 }
  },
  WTD: {
    netRevenue: { value: 28450, change: 10.2 },
    sssg: { value: 11.8, change: 1.5 },
    guestCount: { value: 3240, change: 3.4 },
    avgTicket: { value: 8.78, change: 6.2 }
  },
  MTD: {
    netRevenue: { value: 112500, change: 14.8 },
    sssg: { value: 13.2, change: 4.1 },
    guestCount: { value: 12840, change: 8.9 },
    avgTicket: { value: 8.76, change: 5.9 }
  }
};

export const OPERATIONAL_DATA: OperationalMetrics = {
  avgTripTime: { value: 185, change: -5, target: 210, status: 'green' },
  p90TripTime: { value: 245, change: 2, target: 270, status: 'green' },
  carsPerHour: { value: 42, change: 12, target: 45, status: 'yellow' },
  ordersPerLaborHour: { value: 18, change: 5, target: 20, status: 'yellow' }
};

export const LABOR_DATA: LaborMetrics = {
  laborPercent: { value: 22.4, change: -1.2 },
  revPerLaborHour: { value: 115, change: 8.4 },
  laborVariance: { value: 4.2, change: 15 },
  callOutRate: { value: 1.5, change: -20 }
};

export const EXPERIENCE_DATA: ExperienceMetrics = {
  googleRating: { value: 4.8, change: 0.1 },
  fiveStarReviews: { value: 142, change: 12 },
  reviewVelocity: { value: 2.4, change: 8 },
  refundRemakeRate: { value: 0.8, change: -15 }
};

export const SHIFT_LEADS: ShiftLeadData[] = [
  { id: '1', name: 'Sarah Jenkins', avgTicket: 9.12, avgTripTime: 178, salesPerLaborHour: 125 },
  { id: '2', name: 'Mike Rodriguez', avgTicket: 8.45, avgTripTime: 192, salesPerLaborHour: 110 },
  { id: '3', name: 'Alex Lawson', avgTicket: 8.85, avgTripTime: 185, salesPerLaborHour: 118 }
];

export const REVENUE_MIX: RevenueMix[] = [
  { channel: 'Drive-thru', value: 65 },
  { channel: 'Mobile/App', value: 25 },
  { channel: 'Third-Party', value: 10 }
];

export const REVENUE_CHART_DATA = [
  { time: '06:00', revenue: 240, transactions: 35 },
  { time: '07:00', revenue: 580, transactions: 72 },
  { time: '08:00', revenue: 950, transactions: 110 },
  { time: '09:00', revenue: 820, transactions: 95 },
  { time: '10:00', revenue: 450, transactions: 50 },
  { time: '11:00', revenue: 380, transactions: 42 },
  { time: '12:00', revenue: 520, transactions: 60 }
];

// Financial/Budget Data
export const BUDGET_DATA = {
  // Monthly budgets for 2026
  monthly: {
    january: { revenue: 180000, labor: 40000, cogs: 54000, marketing: 8000, other: 25000 },
    february: { revenue: 175000, labor: 39000, cogs: 52500, marketing: 8500, other: 24000 },
    march: { revenue: 190000, labor: 42000, cogs: 57000, marketing: 9000, other: 26000 },
  },
  // Current month actuals (February)
  currentMonth: {
    budget: 175000,
    actual: 112500, // MTD actual
    daysElapsed: 7,
    daysInMonth: 28,
    dailyTarget: 6250, // 175000 / 28
  },
  // Year to date
  ytd: {
    budgetRevenue: 355000,
    actualRevenue: 292500,
    budgetProfit: 71000,
    actualProfit: 58500,
  },
  // Expense breakdown (current month)
  expenses: {
    labor: { budget: 39000, actual: 25200, pctOfRevenue: 22.4 },
    cogs: { budget: 52500, actual: 33750, pctOfRevenue: 30.0 },
    marketing: { budget: 8500, actual: 6200, pctOfRevenue: 5.5 },
    rent: { budget: 12000, actual: 12000, pctOfRevenue: 10.7 },
    utilities: { budget: 3500, actual: 2100, pctOfRevenue: 1.9 },
    other: { budget: 8500, actual: 5200, pctOfRevenue: 4.6 },
  },
};

// Forecast Data
export const FORECAST_DATA = {
  // End of month projection based on current run rate
  eomProjection: {
    revenue: 175000, // Projected based on daily average
    confidence: 85, // % confidence in projection
    bestCase: 185000,
    worstCase: 165000,
  },
  // Weekly trend for forecasting
  weeklyTrend: [
    { week: 'W1', actual: 42500, budget: 43750, forecast: null },
    { week: 'W2', actual: 45000, budget: 43750, forecast: null },
    { week: 'W3', actual: 25000, budget: 43750, forecast: 44000 }, // Current week partial
    { week: 'W4', actual: null, budget: 43750, forecast: 43500 },
  ],
  // Daily run rate
  dailyMetrics: {
    avgDailyRevenue: 16071, // Based on first 7 days
    requiredDailyToHitBudget: 6250,
    trendDirection: 'up',
    trendPct: 8.2,
  },
};
