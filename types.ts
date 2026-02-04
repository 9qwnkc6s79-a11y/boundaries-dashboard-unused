
export type Period = 'Today' | 'WTD' | 'MTD';

export interface MetricValue {
  value: number | string;
  change: number; // YoY % change
  target?: number;
  status?: 'green' | 'yellow' | 'red';
}

export interface RevenueMetrics {
  netRevenue: MetricValue;
  sssg: MetricValue;
  guestCount: MetricValue;
  avgTicket: MetricValue;
}

export interface OperationalMetrics {
  avgTripTime: MetricValue;
  p90TripTime: MetricValue;
  carsPerHour: MetricValue;
  ordersPerLaborHour: MetricValue;
}

export interface LaborMetrics {
  laborPercent: MetricValue;
  revPerLaborHour: MetricValue;
  laborVariance: MetricValue;
  callOutRate: MetricValue;
}

export interface ExperienceMetrics {
  googleRating: MetricValue;
  fiveStarReviews: MetricValue;
  reviewVelocity: MetricValue;
  refundRemakeRate: MetricValue;
}

export interface ShiftLeadData {
  id: string;
  name: string;
  avgTicket: number;
  avgTripTime: number;
  salesPerLaborHour: number;
}

export interface RevenueMix {
  channel: string;
  value: number;
}
