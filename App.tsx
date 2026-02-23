
import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, ReferenceLine
} from 'recharts';
import {
  REVENUE_DATA, OPERATIONAL_DATA, SHIFT_LEADS, REVENUE_CHART_DATA, LABOR_DATA, EXPERIENCE_DATA, BUDGET_DATA, FORECAST_DATA
} from './mockData';
import StatCard from './components/StatCard';
import ShiftLeadTable from './components/ShiftLeadTable';
import type { Period } from './types';
import { useToastData, useLocationFilter } from './src/hooks/useToastData';
import { useLaborData } from './src/hooks/useLaborData';
import { useOperationsData } from './src/hooks/useOperationsData';
import { useBudgetData, type Month } from './src/hooks/useBudgetData';
import { useDailySalesData } from './src/hooks/useDailySalesData';
import type { DailySales } from './src/hooks/useDailySalesData';
import { useMetaAds, type MetaPeriod } from './src/hooks/useMetaAds';
import { useOpenClawSessions, useOpenClawChat, useOpenClawHistory, type OpenClawSession, type ChatMessage } from './src/hooks/useOpenClaw';
import { useBlandCalls, useInitiateCall, type BlandCall } from './src/hooks/useBlandCalls';
import { useCredentials, type CredentialService } from './src/hooks/useCredentials';


const SidebarItem = ({ label, active = false, onClick, icon }: { label: string, active?: boolean, onClick: () => void, icon: React.ReactNode }) => (
  <div
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-all ${active ? 'bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20' : 'text-zinc-600 hover:text-zinc-300 hover:bg-[#111113] rounded-xl'}`}
  >
    <span className="w-5 h-5">{icon}</span>
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [period, setPeriod] = useState<Period>('MTD');

  // Location filter hook
  const { location, setLocation, locations } = useLocationFilter();

  // Fetch real data from Toast APIs
  const { data, loading, error, refetch, isLiveData } = useToastData(period, location);
  const { data: laborApiData, loading: laborLoading } = useLaborData(period, location);
  const { data: opsApiData, loading: opsLoading } = useOperationsData(period, location);
  const { budgets, updateBudget, getBudgetForMonth, MONTHS } = useBudgetData();
  const { data: dailySalesData } = useDailySalesData(location);

  // Marketing hooks
  const [metaPeriod, setMetaPeriod] = useState<MetaPeriod>('7d');
  const { data: metaData, loading: metaLoading, error: metaError } = useMetaAds(metaPeriod);
  const metaConnected = !!metaData?.summary;

  // Credentials hooks
  const { services: credServices, updateCredential } = useCredentials();
  const [credInputs, setCredInputs] = useState<Record<string, string>>({});
  const [credSaving, setCredSaving] = useState<string | null>(null);

  // Team page hooks
  const { sessions: openClawSessions, loading: sessionsLoading } = useOpenClawSessions();
  const { sendMessage, sending: chatSending } = useOpenClawChat();
  const { calls: blandCalls, refetch: refetchCalls } = useBlandCalls();
  const { initiateCall, calling: blandCalling } = useInitiateCall();

  // Team page state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callPhone, setCallPhone] = useState('');
  const [callTask, setCallTask] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Use API data - no fallbacks to mock data
  const revenueData = data?.revenueMetrics || { netRevenue: { value: 0, change: 0 }, sssg: { value: 0, change: 0 }, guestCount: { value: 0, change: 0 }, avgTicket: { value: 0, change: 0 } };
  
  // Build operational data from real API
  const operationalData = {
    avgTripTime: { value: opsApiData?.avgTripTime || 0, change: 0, target: 210, status: 'green' as const },
    p90TripTime: { value: opsApiData?.p90TripTime || 0, change: 0, target: 270, status: 'green' as const },
    carsPerHour: { value: opsApiData?.carsPerHour || 0, change: 0, target: 45, status: 'yellow' as const },
    ordersPerLaborHour: { value: laborApiData?.revPerLaborHour ? Math.round(laborApiData.totalSales / laborApiData.totalLaborHours / 10) : 0, change: 0, target: 20, status: 'yellow' as const },
  };
  
  // Build labor data from real API
  const laborData = {
    laborPercent: { value: laborApiData?.laborPercent || 0, change: 0 },
    revPerLaborHour: { value: laborApiData?.revPerLaborHour || 0, change: 0 },
    laborVariance: { value: 0, change: 0 }, // Would need budget comparison
    callOutRate: { value: 0, change: 0 }, // Would need scheduling data
  };
  
  // Build experience data from real API
  const experienceData = {
    googleRating: { value: 4.9, change: 0 }, // TODO: Need GBP API
    fiveStarReviews: { value: 597, change: 0 }, // TODO: Need GBP API  
    reviewVelocity: { value: 0, change: 0 }, // TODO: Need GBP API
    refundRemakeRate: { value: opsApiData?.refundRate || 0, change: 0 },
  };
  
  // Build shift leads from labor API
  const shiftLeads = (laborApiData?.topEmployees || []).slice(0, 3).map((emp, i) => ({
    id: emp.guid || String(i),
    name: emp.name || 'Unknown',
    avgTicket: revenueData.avgTicket.value,
    avgTripTime: operationalData.avgTripTime.value,
    salesPerLaborHour: laborApiData?.revPerLaborHour || 0,
  }));
  
  // Use real hourly data from operations API
  const hourlyData = opsApiData?.hourlyData || [];

  const refreshInterval = 300000; // 5 minutes
  const [lastSync, setLastSync] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => {
      setLastSync(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    if (refreshInterval > 0) {
      refreshTimer.current = setInterval(handleRefresh, refreshInterval);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [refreshInterval]);

  // Budget pace calculations using real sales data + user-editable budget
  const now = new Date();
  const currentMonthName = MONTHS[now.getMonth()];
  const locationKey = location === 'littleelm' ? 'littleelm' : location === 'prosper' ? 'prosper' : undefined;
  const mtdBudget = getBudgetForMonth(currentMonthName, locationKey);
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const mtdActual = revenueData.netRevenue.value || 0;
  const pctMonthComplete = Math.round((daysElapsed / daysInMonth) * 100);
  const dailyRunRate = daysElapsed > 0 ? mtdActual / daysElapsed : 0;
  const projectedEOM = Math.round(dailyRunRate * daysInMonth);
  const projectedVariance = projectedEOM - mtdBudget;
  const isOnPace = projectedEOM >= mtdBudget;
  const budgetPaceTarget = Math.round(mtdBudget * (daysElapsed / daysInMonth));
  const pctOfBudget = mtdBudget > 0 ? Math.min((mtdActual / mtdBudget) * 100, 100) : 0;

  const renderDashboard = () => (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Data source indicator — fixed height to prevent layout shift */}
      <div className="h-10 flex items-center">
        {(loading || laborLoading || opsLoading) ? (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-sm flex items-center space-x-2 w-full transition-opacity">
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span>Loading real-time data from Toast POS...</span>
          </div>
        ) : !isLiveData ? (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-xl text-sm flex items-center space-x-2 w-full transition-opacity">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>Unable to fetch live data - check API connection</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Net Sales" value={isLiveData ? revenueData.netRevenue.value : 'N/A'} change={revenueData.netRevenue.change} isCurrency={isLiveData} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
        <StatCard label="SSSG (%)" value={isLiveData ? revenueData.sssg.value : 'N/A'} change={revenueData.sssg.change} isPercent={isLiveData} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>} />
        <StatCard label="Guest Count" value={isLiveData ? revenueData.guestCount.value : 'N/A'} change={revenueData.guestCount.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} />
        <StatCard label="Average Ticket" value={isLiveData ? revenueData.avgTicket.value : 'N/A'} change={revenueData.avgTicket.change} isCurrency={isLiveData} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card glow-top p-8 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-zinc-100">MTD Revenue vs Budget</h3>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isOnPace ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isOnPace ? 'On Pace' : 'Behind Pace'}
            </span>
          </div>

          {/* Hero numbers */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">MTD Actual</p>
              <p className="text-2xl font-black text-zinc-100 tabular-nums">${mtdActual.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Monthly Budget</p>
              <p className="text-2xl font-black text-zinc-500 tabular-nums">${mtdBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">EOM Projection</p>
              <p className={`text-2xl font-black tabular-nums ${isOnPace ? 'text-emerald-400' : 'text-rose-400'}`}>${projectedEOM.toLocaleString()}</p>
            </div>
          </div>

          {/* Daily cumulative chart */}
          {(() => {
            // Build cumulative data from daily sales
            const dailyTarget = mtdBudget / daysInMonth;
            const chartData = [];
            let cumulative = 0;
            for (let day = 1; day <= daysInMonth; day++) {
              const dailyEntry = dailySalesData.find((d: DailySales) => d.day === day);
              if (dailyEntry) {
                cumulative += dailyEntry.sales;
              }
              chartData.push({
                day,
                actual: day <= daysElapsed ? Math.round(cumulative) : undefined,
                budgetPace: Math.round(dailyTarget * day),
              });
            }
            return (
              <div className="h-[220px] mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorActualMtd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1e1e23" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#52525b' }}
                      tickFormatter={(d: number) => d % 5 === 1 ? `${d}` : ''}
                    />
                    <YAxis
                      hide
                      domain={[0, mtdBudget * 1.1]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#f4f4f5' }}
                      itemStyle={{ color: '#a1a1aa' }}
                      labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                      labelFormatter={(d: number) => `Day ${d}`}
                      formatter={(value: any, name: string) => [value != null ? `$${Number(value).toLocaleString()}` : '—', name === 'actual' ? 'Actual' : 'Budget Pace']}
                    />
                    <Line type="monotone" dataKey="budgetPace" stroke="#52525b" strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Budget Pace" />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" fill="url(#colorActualMtd)" strokeWidth={2.5} dot={false} name="Actual" connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Bottom metrics */}
          <div className="grid grid-cols-4 gap-4 mt-auto">
            <div className="p-3 bg-[#1a1a1f] rounded-xl">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Daily Run Rate</p>
              <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">${Math.round(dailyRunRate).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#1a1a1f] rounded-xl">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Daily Target</p>
              <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">${Math.round(mtdBudget / daysInMonth).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#1a1a1f] rounded-xl">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Remaining</p>
              <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">${Math.max(0, mtdBudget - mtdActual).toLocaleString()}</p>
            </div>
            <div className={`p-3 rounded-xl ${isOnPace ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isOnPace ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>Variance</p>
              <p className={`text-sm font-black tabular-nums mt-1 ${isOnPace ? 'text-emerald-400' : 'text-rose-400'}`}>{projectedVariance >= 0 ? '+' : ''}${projectedVariance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Sales Mix</h3>
          <div className="flex-grow flex flex-col justify-center space-y-5">
            {[
              { label: 'Beverages', pct: 72, color: '#3b82f6' },
              { label: 'Food', pct: 22, color: '#6366f1' },
              { label: 'Retail', pct: 6, color: '#8b5cf6' },
            ].map((cat) => (
              <div key={cat.label}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-sm font-semibold text-zinc-300">{cat.label}</span>
                  </div>
                  <span className="text-sm font-black text-zinc-100 tabular-nums">{cat.pct}%</span>
                </div>
                <div className="w-full h-2 bg-[#1e1e23] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}></div>
                </div>
              </div>
            ))}
            <div className="pt-4 mt-auto border-t border-[#1e1e23]">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#1a1a1f] rounded-xl">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Avg Bev Ticket</p>
                  <p className="text-sm font-black text-zinc-100 mt-1">${revenueData.avgTicket.value > 0 ? (revenueData.avgTicket.value * 0.72).toFixed(2) : 'N/A'}</p>
                </div>
                <div className="p-3 bg-[#1a1a1f] rounded-xl">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Food Attach %</p>
                  <p className="text-sm font-black text-zinc-100 mt-1">22%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <section className="glass-card glow-top rounded-2xl overflow-hidden mt-10">
        <div className="px-8 py-6 border-b border-[#1e1e23] flex justify-between items-center">
          <h3 className="text-lg font-bold text-zinc-100">Shift Execution Leaderboard</h3>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Shifts</span>
          </div>
        </div>
        <ShiftLeadTable leads={shiftLeads} />
      </section>
    </div>
  );

  const renderOpsHealth = () => {
    const ratingPct = Math.round((Number(experienceData.googleRating.value) / 5) * 100);

    return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Turn Time" value={`${operationalData.avgTripTime.value}s`} change={operationalData.avgTripTime.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
        <StatCard label="P90 Service" value={`${operationalData.p90TripTime.value}s`} change={operationalData.p90TripTime.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>} />
        <StatCard label="Labor Cost (%)" value={laborData.laborPercent.value} change={laborData.laborPercent.change} isPercent icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} />
        <StatCard label="Cars / Hour" value={operationalData.carsPerHour.value} change={operationalData.carsPerHour.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-zinc-100">Service Speed Trends</h3>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${operationalData.avgTripTime.value <= 210 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
              {operationalData.avgTripTime.value <= 210 ? 'On Target' : 'Above Target'}
            </span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1e1e23" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#52525b'}} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#f4f4f5' }} itemStyle={{ color: '#a1a1aa' }} labelStyle={{ color: '#f4f4f5', fontWeight: 600 }} />
                <Line type="monotone" dataKey="transactions" name="Orders" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', stroke: '#09090b', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 2, strokeOpacity: 0.3 }} />
                <Line type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Labor & Quality Health</h3>
          <div className="space-y-6 flex-grow">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#1a1a1f] rounded-xl border border-[#1e1e23]">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Rev / Labor Hour</p>
                <p className="text-xl font-black text-zinc-100">${laborData.revPerLaborHour.value}</p>
                <p className="text-[9px] text-emerald-400 font-bold mt-1">Goal: $125.00</p>
              </div>
              <div className="p-4 bg-[#1a1a1f] rounded-xl border border-[#1e1e23]">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Labor Variance</p>
                <p className="text-xl font-black text-rose-400">+{laborData.laborVariance.value}h</p>
                <p className="text-[9px] text-rose-400 font-bold mt-1">Over Budget</p>
              </div>
            </div>

            <div className="p-6 bg-[#0a0a0c] rounded-xl text-white border border-[#1e1e23]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Guest Experience Rating</span>
                <span className="text-xl font-black">{experienceData.googleRating.value} / 5</span>
              </div>
              <div className="w-full bg-[#1e1e23] h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${ratingPct}%` }}></div>
              </div>
              <div className="flex justify-between mt-4">
                <div className="text-center">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase">Refunds</p>
                  <p className="text-xs font-bold text-rose-400">{experienceData.refundRemakeRate.value}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase">5-Star Count</p>
                  <p className="text-xs font-bold text-emerald-400">{experienceData.fiveStarReviews.value}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase">Velocity</p>
                  <p className="text-xs font-bold text-blue-400">{experienceData.reviewVelocity.value}x</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guest Highlights + Camera Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card glow-top p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-zinc-100">Guest Highlights</h3>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">
              Connect GBP
            </button>
          </div>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-[#1a1a1f] rounded-2xl flex items-center justify-center mb-4 border border-[#1e1e23]">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-400 mb-2">No reviews connected yet</p>
            <p className="text-xs text-zinc-600 max-w-sm">Link your Google Business Profile to see real-time guest feedback, ratings, and review trends directly in your dashboard.</p>
          </div>
        </div>

        <div className="space-y-6">
          {[
            { name: 'Little Elm', id: 'littleelm' },
            { name: 'Prosper', id: 'prosper' },
          ].map((store) => (
            <div key={store.id} className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1e1e23] flex justify-between items-center">
                <h4 className="text-sm font-bold text-zinc-200">{store.name}</h4>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Camera</span>
              </div>
              <div className="aspect-video bg-[#0a0a0c] flex flex-col items-center justify-center">
                <svg className="w-10 h-10 text-zinc-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">No stream configured</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  const renderMarketing = () => {
    const s = metaData?.summary;
    const campaigns = metaData?.campaigns || [];
    const dailyData = metaData?.dailyData || [];

    return (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Status banner */}
      <div className="h-10 flex items-center">
        {metaLoading ? (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-sm flex items-center space-x-2 w-full">
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span>Loading Meta Ads data...</span>
          </div>
        ) : metaError ? (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl text-sm flex items-center space-x-2 w-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>Meta API error — check access token</span>
          </div>
        ) : null}
      </div>

      {/* Period selector */}
      <div className="flex items-center space-x-3">
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Period</span>
        <div className="flex items-center bg-[#111113] p-1 rounded-xl border border-[#1e1e23]">
          {(['1d', '7d', '30d', '90d'] as MetaPeriod[]).map((p) => (
            <button key={p} onClick={() => setMetaPeriod(p)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${metaPeriod === p ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Ad Spend" value={s ? `${s.spend.toFixed(2)}` : '—'} change={0} isCurrency={!!s} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
        <StatCard label="ROAS" value={s ? `${s.roas}x` : '—'} change={0} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>} />
        <StatCard label="CPC" value={s ? `${s.cpc.toFixed(2)}` : '—'} change={0} isCurrency={!!s} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>} />
        <StatCard label="CTR" value={s ? `${s.ctr.toFixed(2)}%` : '—'} change={0} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>} />
      </div>

      {/* Chart + Platform Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-2xl">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Daily Ad Spend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorMetaSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1877F2" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1877F2" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1e1e23" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#52525b'}} tickFormatter={(d: string) => { const parts = d.split('-'); return `${parts[1]}/${parts[2]}`; }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#f4f4f5' }}
                  itemStyle={{ color: '#a1a1aa' }}
                  labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                  formatter={(value: any, name: string) => [`$${Number(value).toFixed(2)}`, name === 'spend' ? 'Spend' : name]}
                />
                <Area type="monotone" dataKey="spend" stroke="#1877F2" fill="url(#colorMetaSpend)" strokeWidth={2.5} name="Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {s && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-[#1a1a1f] rounded-xl">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Impressions</p>
                <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">{s.impressions.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#1a1a1f] rounded-xl">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Clicks</p>
                <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">{s.clicks.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#1a1a1f] rounded-xl">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Reach</p>
                <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">{s.reach.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#1a1a1f] rounded-xl">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Conversions</p>
                <p className="text-sm font-black text-zinc-100 tabular-nums mt-1">{s.conversions}</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Platforms</h3>
          <div className="space-y-6 flex-grow">
            {/* Meta */}
            <div className="p-5 bg-[#1a1a1f] rounded-xl border border-[#1e1e23]">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-8 rounded-full bg-[#1877F2]"></div>
                  <span className="font-bold text-zinc-200">Meta Ads</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${metaConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {metaConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
              {s ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[9px] font-bold text-zinc-600 uppercase">Spend</p><p className="text-sm font-black text-zinc-100">${s.spend.toFixed(2)}</p></div>
                  <div><p className="text-[9px] font-bold text-zinc-600 uppercase">ROAS</p><p className="text-sm font-black text-blue-400">{s.roas}x</p></div>
                  <div><p className="text-[9px] font-bold text-zinc-600 uppercase">CTR</p><p className="text-sm font-black text-zinc-100">{s.ctr.toFixed(2)}%</p></div>
                  <div><p className="text-[9px] font-bold text-zinc-600 uppercase">CPM</p><p className="text-sm font-black text-zinc-100">${s.cpm.toFixed(2)}</p></div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No data available</p>
              )}
            </div>

            {/* TikTok placeholder */}
            <div className="p-5 bg-[#1a1a1f] rounded-xl border border-[#1e1e23]">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-8 rounded-full bg-[#EE1D52]"></div>
                  <span className="font-bold text-zinc-200">TikTok Ads</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Coming Soon</span>
              </div>
              <p className="text-xs text-zinc-600">TikTok Ads API integration pending. Connect your developer account in Settings.</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#1e1e23]">
            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Official Channels</h4>
            <div className="grid grid-cols-2 gap-3">
              <a href="https://facebook.com/boundariescoffee" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-3 bg-[#1877F2]/10 hover:bg-[#1877F2]/15 rounded-xl transition-all group">
                <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200">Meta</span>
              </a>
              <a href="https://tiktok.com/@boundariescoffee" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-3 bg-[#1a1a1f] hover:bg-[#27272a] rounded-xl transition-all group border border-[#1e1e23]">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.02-.73 2.24-1.09 3.48-1.11V12c-.22.01-.45.03-.66.1-.96.22-1.78.96-2.12 1.89-.35.8-.25 1.76.2 2.48.51.8 1.4 1.31 2.34 1.34 1.16.1 2.35-.61 2.76-1.68.21-.49.25-1.03.24-1.56l.03-14.55z"/></svg>
                <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200">TikTok</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      {campaigns.length > 0 && (
        <div className="glass-card glow-top rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-[#1e1e23]">
            <h3 className="text-lg font-bold text-zinc-100">Campaign Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#1e1e23]">
              <thead>
                <tr className="bg-[#0d0d10]">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Campaign</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Spend</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Impressions</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Clicks</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase tracking-widest">CTR</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase tracking-widest">CPC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e23]">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1a1a1f] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-zinc-200 truncate max-w-[200px]">{c.name}</p>
                      <p className="text-[10px] text-zinc-600">{c.objective}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-zinc-100 tabular-nums">{c.metrics ? `$${c.metrics.spend.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 text-right text-sm text-zinc-300 tabular-nums">{c.metrics ? c.metrics.impressions.toLocaleString() : '—'}</td>
                    <td className="px-6 py-4 text-right text-sm text-zinc-300 tabular-nums">{c.metrics ? c.metrics.clicks.toLocaleString() : '—'}</td>
                    <td className="px-6 py-4 text-right text-sm text-zinc-300 tabular-nums">{c.metrics ? `${c.metrics.ctr.toFixed(2)}%` : '—'}</td>
                    <td className="px-6 py-4 text-right text-sm text-zinc-300 tabular-nums">{c.metrics ? `$${c.metrics.cpc.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    );
  };

  const renderFinancials = () => {
    const budget = BUDGET_DATA.currentMonth;
    const forecast = FORECAST_DATA;
    const pctComplete = Math.round((budget.daysElapsed / budget.daysInMonth) * 100);
    const paceToHitBudget = (budget.actual / budget.daysElapsed) * budget.daysInMonth;
    const projectedVariance = paceToHitBudget - budget.budget;
    const isOnPace = paceToHitBudget >= budget.budget;

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
        {/* Budget vs Actual Header Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="MTD Revenue" 
            value={budget.actual} 
            change={((budget.actual / (budget.budget * pctComplete / 100)) - 1) * 100} 
            isCurrency 
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} 
          />
          <StatCard 
            label="Monthly Budget" 
            value={budget.budget} 
            change={0} 
            isCurrency 
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>} 
          />
          <StatCard 
            label="EOM Projection" 
            value={Math.round(paceToHitBudget)} 
            change={Math.round((projectedVariance / budget.budget) * 100)} 
            isCurrency 
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>} 
          />
          <StatCard 
            label="Confidence" 
            value={`${forecast.eomProjection.confidence}%`} 
            change={5} 
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} 
          />
        </div>

        {/* Budget Progress & Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Budget Progress */}
          <div className="lg:col-span-2 glass-card p-8 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Budget vs Actual (February)</h3>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isOnPace ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {isOnPace ? 'On Track' : 'Behind Pace'}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-zinc-400">Month Progress: {pctComplete}%</span>
                <span className="font-bold text-zinc-100">${budget.actual.toLocaleString()} / ${budget.budget.toLocaleString()}</span>
              </div>
              <div className="w-full h-4 bg-[#1e1e23] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isOnPace ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((budget.actual / budget.budget) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs mt-2 text-zinc-600">
                <span>Day {budget.daysElapsed} of {budget.daysInMonth}</span>
                <span>Target pace: ${Math.round(budget.budget * pctComplete / 100).toLocaleString()}</span>
              </div>
            </div>

            {/* Weekly Trend Chart */}
            <h4 className="text-sm font-bold text-zinc-300 mb-4">Weekly Performance</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecast.weeklyTrend}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1e1e23" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#52525b'}} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: any) => value ? `$${value.toLocaleString()}` : 'N/A'}
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#f4f4f5' }}
                    itemStyle={{ color: '#a1a1aa' }}
                    labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                  />
                  <Bar dataKey="budget" name="Budget" fill="#27272a" radius={[4, 4, 4, 4]} barSize={30} />
                  <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={30} />
                  <Bar dataKey="forecast" name="Forecast" fill="#6366f1" radius={[4, 4, 4, 4]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast Summary */}
          <div className="glass-card p-8 rounded-2xl flex flex-col">
            <h3 className="text-lg font-bold text-zinc-100 mb-6">End of Month Forecast</h3>
            
            <div className="flex-grow flex flex-col justify-center">
              {/* Projection Gauge */}
              <div className="text-center mb-8">
                <div className="text-4xl font-black text-zinc-100">${Math.round(paceToHitBudget).toLocaleString()}</div>
                <div className="text-sm text-zinc-500 mt-1">Projected Revenue</div>
                <div className={`text-sm font-bold mt-2 ${projectedVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {projectedVariance >= 0 ? '+' : ''}${Math.round(projectedVariance).toLocaleString()} vs budget
                </div>
              </div>

              {/* Range */}
              <div className="bg-[#1a1a1f] p-4 rounded-xl mb-6">
                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Projection Range</div>
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <div className="text-xs text-zinc-600">Worst</div>
                    <div className="text-sm font-bold text-zinc-300">${forecast.eomProjection.worstCase.toLocaleString()}</div>
                  </div>
                  <div className="flex-grow mx-4 h-2 bg-gradient-to-r from-rose-500/30 via-amber-500/30 to-emerald-500/30 rounded-full"></div>
                  <div className="text-center">
                    <div className="text-xs text-zinc-600">Best</div>
                    <div className="text-sm font-bold text-zinc-300">${forecast.eomProjection.bestCase.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Daily Metrics */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#1a1a1f] rounded-xl">
                  <span className="text-sm text-zinc-400">Avg Daily Revenue</span>
                  <span className="font-bold text-zinc-100">${forecast.dailyMetrics.avgDailyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#1a1a1f] rounded-xl">
                  <span className="text-sm text-zinc-400">Daily Target</span>
                  <span className="font-bold text-zinc-100">${forecast.dailyMetrics.requiredDailyToHitBudget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl">
                  <span className="text-sm text-emerald-400">Trend</span>
                  <span className="font-bold text-emerald-400">↑ {forecast.dailyMetrics.trendPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="glass-card p-8 rounded-2xl">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Expense Breakdown (MTD)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(BUDGET_DATA.expenses).map(([key, exp]) => (
              <div key={key} className="p-4 bg-[#1a1a1f] rounded-xl">
                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">{key}</div>
                <div className="text-lg font-black text-zinc-100">${exp.actual.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">of ${exp.budget.toLocaleString()}</div>
                <div className="mt-2 w-full h-1.5 bg-[#1e1e23] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${(exp.actual / exp.budget) > 0.9 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((exp.actual / exp.budget) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">{exp.pctOfRevenue}% of rev</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleCredSave = async (key: string) => {
    const value = credInputs[key];
    if (!value?.trim()) return;
    setCredSaving(key);
    const ok = await updateCredential(key, value.trim());
    if (ok) {
      setCredInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setCredSaving(null);
  };

  const svcIcons: Record<string, React.ReactNode> = {
    pos: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>,
    meta: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>,
    phone: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
    bot: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  };

  const renderSettings = () => (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* API Connections */}
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-zinc-100">API Connections</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage credentials for integrated services. Values are masked for security.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {credServices.map((svc) => (
            <div key={svc.id} className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1e1e23] flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-[#1a1a1f] rounded-xl flex items-center justify-center text-blue-400 border border-[#1e1e23]">
                    {svcIcons[svc.icon] || svcIcons.bot}
                  </div>
                  <span className="text-sm font-bold text-zinc-100">{svc.name}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  svc.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {svc.connected ? 'Connected' : 'Not Configured'}
                </span>
              </div>
              <div className="p-6 space-y-3">
                {svc.fields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-3">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest w-28 flex-shrink-0 truncate" title={field.label}>{field.label}</label>
                    <input
                      type="text"
                      value={credInputs[field.key] || ''}
                      onChange={(e) => setCredInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.hasValue ? field.masked : 'Not set'}
                      onKeyDown={(e) => e.key === 'Enter' && handleCredSave(field.key)}
                      className="flex-grow bg-[#1a1a1f] border border-[#1e1e23] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none transition-colors font-mono"
                    />
                    <button
                      onClick={() => handleCredSave(field.key)}
                      disabled={!credInputs[field.key]?.trim() || credSaving === field.key}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold transition-colors flex-shrink-0"
                    >
                      {credSaving === field.key ? '...' : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Budget */}
      <div className="glass-card glow-top p-8 rounded-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Revenue Budget</h3>
            <p className="text-sm text-zinc-500 mt-1">Set monthly revenue targets per location. Changes save automatically.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e23]">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest w-28">Location</th>
                {MONTHS.map((m, i) => (
                  <th key={m} className="px-2 py-3 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{MONTH_LABELS[i]}</th>
                ))}
                <th className="px-4 py-3 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Total</th>
              </tr>
            </thead>
            <tbody>
              {(['littleelm', 'prosper'] as const).map((loc) => (
                <tr key={loc} className="border-b border-[#1e1e23]">
                  <td className="px-4 py-4 text-sm font-semibold text-zinc-300">{loc === 'littleelm' ? 'Little Elm' : 'Prosper'}</td>
                  {MONTHS.map((month) => (
                    <td key={month} className="px-2 py-4">
                      <input
                        type="number"
                        defaultValue={budgets[month][loc]}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== budgets[month][loc]) {
                            updateBudget(month, loc, val);
                          }
                        }}
                        className="w-20 bg-[#1a1a1f] border border-[#1e1e23] rounded-lg px-2 py-1.5 text-xs text-zinc-200 text-right tabular-nums focus:border-blue-500/50 focus:outline-none transition-colors"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-4 text-sm font-black text-zinc-100 text-right tabular-nums">
                    ${MONTHS.reduce((sum, m) => sum + budgets[m][loc], 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#0d0d10]">
                <td className="px-4 py-4 text-sm font-bold text-zinc-400">Combined</td>
                {MONTHS.map((month) => (
                  <td key={month} className="px-2 py-4 text-center text-xs font-bold text-zinc-400 tabular-nums">
                    ${(budgets[month].littleelm + budgets[month].prosper).toLocaleString()}
                  </td>
                ))}
                <td className="px-4 py-4 text-sm font-black text-blue-400 text-right tabular-nums">
                  ${MONTHS.reduce((sum, m) => sum + budgets[m].littleelm + budgets[m].prosper, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Team page helpers
  const selectedSession = openClawSessions.find(s => s.agentId === selectedAgentId || s.sessionKey === selectedAgentId);
  const totalTokens = openClawSessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedAgentId) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date().toISOString() };
    setLocalMessages(prev => [...prev, userMsg]);
    setChatInput('');
    try {
      const response = await sendMessage(selectedAgentId, chatInput, selectedSession?.sessionKey);
      const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toISOString() };
      setLocalMessages(prev => [...prev, assistantMsg]);
    } catch {
      setLocalMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response', timestamp: new Date().toISOString() }]);
    }
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleInitiateCall = async () => {
    if (!callPhone.trim()) return;
    try {
      await initiateCall(callPhone, callTask || 'You are a helpful assistant for Boundaries Coffee.');
      setShowCallModal(false);
      setCallPhone('');
      setCallTask('');
      setTimeout(() => refetchCalls(), 2000);
    } catch {
      // Error handled in hook
    }
  };

  const renderTeam = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Main chat layout */}
      <div className="flex gap-6" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
        {/* Agent sidebar */}
        <div className="w-64 flex-shrink-0 glass-card rounded-2xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e23]">
            <h3 className="text-sm font-bold text-zinc-100">Agents</h3>
            <p className="text-[10px] text-zinc-600 mt-1">{openClawSessions.length} sessions</p>
          </div>

          <div className="flex-grow overflow-y-auto p-3 space-y-1">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-5 h-5 animate-spin text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </div>
            ) : openClawSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-600">No agents found</p>
                <p className="text-[10px] text-zinc-700 mt-1">Start OpenClaw gateway</p>
              </div>
            ) : (
              openClawSessions.map((session) => {
                const isSelected = selectedAgentId === (session.agentId || session.sessionKey);
                const isActive = session.updatedAt && (Date.now() - new Date(session.updatedAt).getTime()) < 300000; // 5 min
                return (
                  <button
                    key={session.sessionId || session.sessionKey}
                    onClick={() => {
                      setSelectedAgentId(session.agentId || session.sessionKey);
                      setSelectedSessionId(session.sessionId || session.sessionKey);
                      setLocalMessages([]);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center space-x-3 ${
                      isSelected ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-[#1a1a1f]'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-[#1a1a1f] flex items-center justify-center text-xs font-bold text-blue-400 border border-[#1e1e23]">
                        {(session.displayName || session.agentId || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111113] ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`}></div>
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{session.displayName || session.agentId || session.sessionKey}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{session.channel || 'direct'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Token usage */}
          <div className="px-5 py-4 border-t border-[#1e1e23]">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Total Tokens</p>
            <p className="text-lg font-black text-zinc-100 tabular-nums">{totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(1)}M` : totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens}</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-grow glass-card rounded-2xl flex flex-col overflow-hidden">
          {selectedAgentId ? (
            <>
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-[#1e1e23] flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400">
                    {(selectedSession?.displayName || selectedAgentId || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-100">{selectedSession?.displayName || selectedAgentId}</p>
                    <p className="text-[10px] text-zinc-600">{selectedSession?.channel || 'direct'} {selectedSession?.updatedAt ? `• Last active: ${new Date(selectedSession.updatedAt).toLocaleTimeString()}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCallModal(true)}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center space-x-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    <span>Call</span>
                  </button>
                  <div className="px-3 py-1.5 bg-[#1a1a1f] rounded-lg text-[10px] font-bold text-zinc-500 tabular-nums">
                    {selectedSession?.totalTokens ? `${(selectedSession.totalTokens / 1000).toFixed(0)}K tokens` : '—'}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {localMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-[#1a1a1f] rounded-2xl flex items-center justify-center mb-4 border border-[#1e1e23]">
                      <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    </div>
                    <p className="text-sm font-semibold text-zinc-400">Start a conversation</p>
                    <p className="text-xs text-zinc-600 mt-1">Send a message to {selectedSession?.displayName || selectedAgentId}</p>
                  </div>
                )}
                {localMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-[#1a1a1f] text-zinc-200 border border-[#1e1e23] rounded-bl-md'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.timestamp && (
                        <p className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-zinc-600'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex justify-start">
                    <div className="bg-[#1a1a1f] text-zinc-400 px-4 py-3 rounded-2xl rounded-bl-md border border-[#1e1e23]">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-6 py-4 border-t border-[#1e1e23]">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                    placeholder="Type a message..."
                    className="flex-grow bg-[#1a1a1f] border border-[#1e1e23] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none transition-colors"
                    disabled={chatSending}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={chatSending || !chatInput.trim()}
                    className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-[#1a1a1f] rounded-2xl flex items-center justify-center mb-4 border border-[#1e1e23]">
                <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <p className="text-lg font-bold text-zinc-400">Select an Agent</p>
              <p className="text-sm text-zinc-600 mt-2 max-w-sm">Choose an agent from the sidebar to start chatting, assign tasks, or make calls.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Calendar + Call History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Schedule */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-zinc-100 mb-4">Team Schedule</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e23]">
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-widest w-24">Agent</th>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <th key={d} className="px-2 py-2 text-center text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(openClawSessions.length > 0 ? openClawSessions : [{ agentId: 'No agents', displayName: 'No agents', sessionKey: 'none' }] as any[]).map((session: any) => (
                  <tr key={session.sessionKey || session.agentId} className="border-b border-[#1e1e23]">
                    <td className="px-3 py-3 text-xs font-semibold text-zinc-300 truncate max-w-[100px]">{session.displayName || session.agentId}</td>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <td key={d} className="px-2 py-3">
                        <div className="w-full h-6 bg-[#1a1a1f] rounded-md border border-[#1e1e23] flex items-center justify-center">
                          <span className="text-[8px] text-zinc-700">—</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Call History */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-zinc-100">Call History</h3>
            <button onClick={() => setShowCallModal(true)} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-colors">
              New Call
            </button>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {blandCalls.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-600">No calls yet</p>
                <p className="text-[10px] text-zinc-700 mt-1">Initiate a call to get started</p>
              </div>
            ) : (
              blandCalls.slice(0, 10).map((call: BlandCall) => (
                <div key={call.call_id} className="flex items-center justify-between p-3 bg-[#1a1a1f] rounded-xl border border-[#1e1e23]">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'completed' ? 'bg-emerald-400' :
                      call.status === 'in-progress' ? 'bg-blue-400 animate-pulse' :
                      'bg-zinc-600'
                    }`}></div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{call.to || call.call_id?.slice(0, 8)}</p>
                      <p className="text-[10px] text-zinc-600">{call.created_at ? new Date(call.created_at).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {call.call_length && (
                      <span className="text-[10px] text-zinc-500 tabular-nums">{Math.round(call.call_length)}s</span>
                    )}
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      call.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      call.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' :
                      call.status === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>{call.status || 'unknown'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCallModal(false)}>
          <div className="bg-[#111113] border border-[#1e1e23] rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-100 mb-6">Initiate Call</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Phone Number</label>
                <input
                  type="tel"
                  value={callPhone}
                  onChange={(e) => setCallPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full mt-2 bg-[#1a1a1f] border border-[#1e1e23] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Instructions (optional)</label>
                <textarea
                  value={callTask}
                  onChange={(e) => setCallTask(e.target.value)}
                  placeholder="What should the AI say on this call?"
                  rows={3}
                  className="w-full mt-2 bg-[#1a1a1f] border border-[#1e1e23] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => setShowCallModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button
                  onClick={handleInitiateCall}
                  disabled={blandCalling || !callPhone.trim()}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors flex items-center space-x-2"
                >
                  {blandCalling ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  )}
                  <span>{blandCalling ? 'Calling...' : 'Start Call'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      <aside className="w-64 bg-[#0a0a0c] text-white flex flex-col p-6 space-y-8 hidden md:flex border-r border-[#1e1e23]">
        <div className="flex items-center space-x-3 mb-4 cursor-pointer" onClick={() => setActiveTab('Dashboard')}>
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
             <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Boundaries</span>
        </div>

        <nav className="flex-grow space-y-1">
          <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4">Main Menu</p>
          <SidebarItem label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>} />
          <SidebarItem label="Ops Health" active={activeTab === 'Ops Health'} onClick={() => setActiveTab('Ops Health')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>} />
          <SidebarItem label="Marketing" active={activeTab === 'Marketing'} onClick={() => setActiveTab('Marketing')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.167H3.3a1.598 1.598 0 01-2.978-1.586l1.241-3.116A1.598 1.598 0 013.3 8.32h2.533l2.147-6.167a1.76 1.76 0 013.417.592z"></path></svg>} />
          <SidebarItem label="Financials" active={activeTab === 'Financials'} onClick={() => setActiveTab('Financials')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>} />
          <SidebarItem label="Team" active={activeTab === 'Team'} onClick={() => setActiveTab('Team')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} />
        </nav>

        <div className="pt-8 border-t border-[#1e1e23]">
          <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-4">Management</p>
          <SidebarItem label="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>} />
        </div>
      </aside>

      <div className="flex-grow flex flex-col overflow-y-auto">
        <header className="h-20 bg-[#09090b]/80 backdrop-blur-xl border-b border-[#1e1e23] flex items-center justify-between px-10 sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">{activeTab}</h2>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${isRefreshing || loading ? 'bg-blue-500/10 text-blue-400 animate-pulse' : isLiveData ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800/50 text-zinc-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isRefreshing || loading ? 'bg-blue-400' : isLiveData ? 'bg-emerald-400 pulse-glow' : 'bg-zinc-600'}`}></div>
              <span>{isRefreshing || loading ? 'Refreshing...' : isLiveData ? 'Live Data' : `Last Sync: ${lastSync.toLocaleTimeString()}`}</span>
            </div>
            {/* Period selector */}
            <div className="flex items-center bg-[#111113] p-1 rounded-xl border border-[#1e1e23]">
              {(['Today', 'WTD', 'MTD'] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${period === p ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>{p}</button>
              ))}
            </div>
            {/* Location selector */}
            <select
              value={location || ''}
              onChange={(e) => setLocation(e.target.value as any || undefined)}
              className="text-[10px] font-bold bg-[#111113] border border-[#1e1e23] rounded-xl px-3 py-1.5 text-zinc-400"
            >
              {locations.map((loc) => (
                <option key={loc.label} value={loc.value || ''}>{loc.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              <span>Export Reports</span>
            </button>
          </div>
        </header>

        <main className="p-10 max-w-[1400px]">
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Ops Health' && renderOpsHealth()}
          {activeTab === 'Marketing' && renderMarketing()}
          {activeTab === 'Financials' && renderFinancials()}
          {activeTab === 'Settings' && renderSettings()}
          {activeTab === 'Team' && renderTeam()}
        </main>
        
        <footer className="px-10 py-10 mt-auto border-t border-[#1e1e23] bg-[#09090b]/50">
           <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
               <div className="flex flex-col">
                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">Operational Health</span>
                <span className={`text-xs font-bold uppercase tracking-tighter flex items-center ${isLiveData ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isLiveData ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  {isLiveData ? 'Live' : 'Sample Data'}
                </span>
              </div>
              <div className="flex flex-col border-l border-[#1e1e23] pl-6">
                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">Data Feed</span>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-tighter">
                  {isLiveData ? `Toast POS • ${location ? locations.find(l => l.value === location)?.label : 'All Locations'}` : 'Demo Mode'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-[9px] font-black tracking-[0.3em] text-zinc-700 uppercase select-none">
              <span>Est. 2021</span>
              <span className="text-rose-400 text-lg leading-none">★</span>
              <span>Boundaries Coffee</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
