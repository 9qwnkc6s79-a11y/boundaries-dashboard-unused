
import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import {
  REVENUE_DATA, OPERATIONAL_DATA, SHIFT_LEADS, REVENUE_CHART_DATA, LABOR_DATA, EXPERIENCE_DATA, BUDGET_DATA, FORECAST_DATA
} from './mockData';
import StatCard from './components/StatCard';
import ShiftLeadTable from './components/ShiftLeadTable';
import type { Period } from './types';
import { useToastData, useLocationFilter } from './src/hooks/useToastData';

// Extended Marketing Data with Social Links
const MARKETING_STATS = {
  totalSpend: 12450,
  totalROAS: 4.2,
  cac: 12.80,
  conversions: 2480,
  platforms: [
    { 
      name: 'Meta Ads', 
      spend: 8200, 
      conversions: 1850, 
      roas: 4.8, 
      ctr: '2.4%', 
      color: '#1877F2',
      profileUrl: 'https://www.facebook.com/boundariescoffee' 
    },
    { 
      name: 'TikTok Ads', 
      spend: 4250, 
      conversions: 630, 
      roas: 3.1, 
      ctr: '1.8%', 
      color: '#EE1D52',
      profileUrl: 'https://www.tiktok.com/@boundariescoffee'
    }
  ],
  trends: [
    { day: 'Mon', spend: 400, rev: 1600 },
    { day: 'Tue', spend: 450, rev: 1900 },
    { day: 'Wed', spend: 380, rev: 1550 },
    { day: 'Thu', spend: 500, rev: 2200 },
    { day: 'Fri', spend: 600, rev: 2800 },
    { day: 'Sat', spend: 700, rev: 3200 },
    { day: 'Sun', spend: 550, rev: 2400 },
  ]
};

const SidebarItem = ({ label, active = false, onClick, icon }: { label: string, active?: boolean, onClick: () => void, icon: React.ReactNode }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-all ${active ? 'bg-slate-800 text-white rounded-xl shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
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

  // Fetch real data from Toast API via Logbook
  const { data, loading, error, refetch, isLiveData } = useToastData(period, location);

  // Use API data if available, fallback to mock data
  const revenueData = data?.revenueMetrics || REVENUE_DATA[period];
  const operationalData = data?.operationalMetrics || OPERATIONAL_DATA;
  const laborData = data?.laborMetrics || LABOR_DATA;
  const experienceData = data?.experienceMetrics || EXPERIENCE_DATA;
  const shiftLeads = data?.shiftLeads || SHIFT_LEADS;
  const hourlyData = data?.hourlyData || REVENUE_CHART_DATA;

  const [refreshInterval, setRefreshInterval] = useState(30000);
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

  const barData = hourlyData.map(d => ({
    name: d.time,
    Investor: d.revenue * 0.5,
    Internal: d.revenue * 0.3,
    Other: d.revenue * 0.2
  }));

  const renderDashboard = () => (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Data source indicator */}
      {!isLiveData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl text-sm flex items-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <span>Showing sample data - API connection pending</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Net Sales" value={revenueData.netRevenue.value} change={revenueData.netRevenue.change} isCurrency icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
        <StatCard label="SSSG (%)" value={revenueData.sssg.value} change={revenueData.sssg.change} isPercent icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>} />
        <StatCard label="Guest Count" value={revenueData.guestCount.value} change={revenueData.guestCount.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} />
        <StatCard label="Average Ticket" value={revenueData.avgTicket.value} change={revenueData.avgTicket.change} isCurrency icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-lg font-bold text-slate-900">Revenue Quality Mix</h3>
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-blue-500"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Drive-thru</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-blue-300"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Mobile</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-blue-100"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Delivery</span></div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                <Bar dataKey="Investor" name="Drive-thru" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={40} />
                <Bar dataKey="Internal" name="Mobile" stackId="a" fill="#93c5fd" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Other" name="Delivery" stackId="a" fill="#dbeafe" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-8">Executive Scorecard</h3>
          <div className="flex-grow flex flex-col justify-center items-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                <circle cx="96" cy="96" r="88" stroke="#3b82f6" strokeWidth="12" fill="transparent" strokeDasharray="552.92" strokeDashoffset="66.35" strokeLinecap="round" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-slate-900">88</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Store Health</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full mt-10">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rank</p>
                <p className="text-sm font-black text-slate-800">#4 of 22</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">vs Last Mo</p>
                <p className="text-sm font-black text-emerald-500">+4 pts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <section className="glass-card rounded-2xl overflow-hidden shadow-xl mt-10">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">Shift Execution Leaderboard</h3>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Shifts</span>
          </div>
        </div>
        <ShiftLeadTable leads={shiftLeads} />
      </section>
    </div>
  );

  const renderOpsHealth = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Avg Trip Time" value={`${operationalData.avgTripTime.value}s`} change={operationalData.avgTripTime.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
        <StatCard label="P90 Service" value={`${operationalData.p90TripTime.value}s`} change={operationalData.p90TripTime.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>} />
        <StatCard label="Labor Cost (%)" value={laborData.laborPercent.value} change={laborData.laborPercent.change} isPercent icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>} />
        <StatCard label="Cars / Hour" value={operationalData.carsPerHour.value} change={operationalData.carsPerHour.change} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Service Speed Trends</h3>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">On Target</span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <YAxis hide domain={[0, 300]} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" name="Service Time (s)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Labor & Quality Health</h3>
          <div className="space-y-6 flex-grow">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rev / Labor Hour</p>
                <p className="text-xl font-black text-slate-900">${laborData.revPerLaborHour.value}</p>
                <p className="text-[9px] text-emerald-500 font-bold mt-1">Goal: $125.00</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Labor Variance</p>
                <p className="text-xl font-black text-rose-500">+{laborData.laborVariance.value}h</p>
                <p className="text-[9px] text-rose-400 font-bold mt-1">Over Budget</p>
              </div>
            </div>
            
            <div className="p-6 bg-slate-900 rounded-xl text-white">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Guest Experience Rating</span>
                <span className="text-xl font-black">4.8 / 5</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[96%]"></div>
              </div>
              <div className="flex justify-between mt-4">
                <div className="text-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Refunds</p>
                  <p className="text-xs font-bold text-rose-400">{experienceData.refundRemakeRate.value}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">5-Star Count</p>
                  <p className="text-xs font-bold text-emerald-400">{experienceData.fiveStarReviews.value}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Velocity</p>
                  <p className="text-xs font-bold text-blue-400">{experienceData.reviewVelocity.value}x</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMarketing = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Ad Spend (MTD)" value={MARKETING_STATS.totalSpend} change={12} isCurrency icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>} />
        <StatCard label="Marketing ROAS" value={MARKETING_STATS.totalROAS} change={8.5} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>} />
        <StatCard label="Customer CAC" value={MARKETING_STATS.cac} change={-5.2} isCurrency icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>} />
        <StatCard label="Conversions" value={MARKETING_STATS.conversions} change={24} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-2xl">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Spend vs Revenue Attribution</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MARKETING_STATS.trends}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="rev" name="Incremental Revenue" stroke="#3b82f6" fill="url(#colorSpend)" strokeWidth={3} />
                <Area type="monotone" dataKey="spend" name="Ad Spend" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-8">Platform performance</h3>
          <div className="space-y-8 flex-grow">
            {MARKETING_STATS.platforms.map(p => (
              <div key={p.name} className="flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: p.color }}></div>
                    <span className="font-bold text-slate-800">{p.name}</span>
                  </div>
                  <a 
                    href={p.profileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-500 transition-all border border-slate-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Spend</p>
                    <p className="text-sm font-black text-slate-900">${p.spend}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ROAS</p>
                    <p className="text-sm font-black text-blue-600">{p.roas}x</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Official Channels</h4>
            <div className="grid grid-cols-2 gap-3">
              <a href="https://facebook.com/boundariescoffee" target="_blank" className="flex items-center space-x-2 p-3 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 rounded-xl transition-all group">
                <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900">Meta Feed</span>
              </a>
              <a href="https://tiktok.com/@boundariescoffee" target="_blank" className="flex items-center space-x-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group border border-slate-100">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.02-.73 2.24-1.09 3.48-1.11V12c-.22.01-.45.03-.66.1-.96.22-1.78.96-2.12 1.89-.35.8-.25 1.76.2 2.48.51.8 1.4 1.31 2.34 1.34 1.16.1 2.35-.61 2.76-1.68.21-.49.25-1.03.24-1.56l.03-14.55z"/></svg>
                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900">TikTok Feed</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
              <h3 className="text-lg font-bold text-slate-900">Budget vs Actual (February)</h3>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isOnPace ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {isOnPace ? 'On Track' : 'Behind Pace'}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-600">Month Progress: {pctComplete}%</span>
                <span className="font-bold text-slate-900">${budget.actual.toLocaleString()} / ${budget.budget.toLocaleString()}</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isOnPace ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((budget.actual / budget.budget) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs mt-2 text-slate-400">
                <span>Day {budget.daysElapsed} of {budget.daysInMonth}</span>
                <span>Target pace: ${Math.round(budget.budget * pctComplete / 100).toLocaleString()}</span>
              </div>
            </div>

            {/* Weekly Trend Chart */}
            <h4 className="text-sm font-bold text-slate-700 mb-4">Weekly Performance</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecast.weeklyTrend}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: any) => value ? `$${value.toLocaleString()}` : 'N/A'}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="budget" name="Budget" fill="#e2e8f0" radius={[4, 4, 4, 4]} barSize={30} />
                  <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={30} />
                  <Bar dataKey="forecast" name="Forecast" fill="#93c5fd" radius={[4, 4, 4, 4]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast Summary */}
          <div className="glass-card p-8 rounded-2xl flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6">End of Month Forecast</h3>
            
            <div className="flex-grow flex flex-col justify-center">
              {/* Projection Gauge */}
              <div className="text-center mb-8">
                <div className="text-4xl font-black text-slate-900">${Math.round(paceToHitBudget).toLocaleString()}</div>
                <div className="text-sm text-slate-500 mt-1">Projected Revenue</div>
                <div className={`text-sm font-bold mt-2 ${projectedVariance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {projectedVariance >= 0 ? '+' : ''}${Math.round(projectedVariance).toLocaleString()} vs budget
                </div>
              </div>

              {/* Range */}
              <div className="bg-slate-50 p-4 rounded-xl mb-6">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Projection Range</div>
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Worst</div>
                    <div className="text-sm font-bold text-slate-600">${forecast.eomProjection.worstCase.toLocaleString()}</div>
                  </div>
                  <div className="flex-grow mx-4 h-2 bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-200 rounded-full"></div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Best</div>
                    <div className="text-sm font-bold text-slate-600">${forecast.eomProjection.bestCase.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Daily Metrics */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-600">Avg Daily Revenue</span>
                  <span className="font-bold text-slate-900">${forecast.dailyMetrics.avgDailyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-600">Daily Target</span>
                  <span className="font-bold text-slate-900">${forecast.dailyMetrics.requiredDailyToHitBudget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                  <span className="text-sm text-emerald-700">Trend</span>
                  <span className="font-bold text-emerald-600">↑ {forecast.dailyMetrics.trendPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="glass-card p-8 rounded-2xl">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Expense Breakdown (MTD)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(BUDGET_DATA.expenses).map(([key, exp]) => (
              <div key={key} className="p-4 bg-slate-50 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{key}</div>
                <div className="text-lg font-black text-slate-900">${exp.actual.toLocaleString()}</div>
                <div className="text-xs text-slate-500">of ${exp.budget.toLocaleString()}</div>
                <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${(exp.actual / exp.budget) > 0.9 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((exp.actual / exp.budget) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{exp.pctOfRevenue}% of rev</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
      <aside className="w-64 bg-[#11141d] text-white flex flex-col p-6 space-y-8 hidden md:flex">
        <div className="flex items-center space-x-3 mb-4 cursor-pointer" onClick={() => setActiveTab('Dashboard')}>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
             <svg className="w-7 h-7 text-[#11141d]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Boundaries</span>
        </div>

        <nav className="flex-grow space-y-1">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Main Menu</p>
          <SidebarItem label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>} />
          <SidebarItem label="Ops Health" active={activeTab === 'Ops Health'} onClick={() => setActiveTab('Ops Health')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>} />
          <SidebarItem label="Marketing" active={activeTab === 'Marketing'} onClick={() => setActiveTab('Marketing')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.167H3.3a1.598 1.598 0 01-2.978-1.586l1.241-3.116A1.598 1.598 0 013.3 8.32h2.533l2.147-6.167a1.76 1.76 0 013.417.592z"></path></svg>} />
          <SidebarItem label="Financials" active={activeTab === 'Financials'} onClick={() => setActiveTab('Financials')} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>} />
        </nav>

        <div className="pt-8 border-t border-slate-800">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Management</p>
          <SidebarItem label="Settings" onClick={() => {}} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>} />
        </div>
      </aside>

      <div className="flex-grow flex flex-col overflow-y-auto">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{activeTab}</h2>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${isRefreshing || loading ? 'bg-blue-50 text-blue-500 animate-pulse' : isLiveData ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isRefreshing || loading ? 'bg-blue-500' : isLiveData ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <span>{isRefreshing || loading ? 'Refreshing...' : isLiveData ? 'Live Data' : `Last Sync: ${lastSync.toLocaleTimeString()}`}</span>
            </div>
            {/* Period selector */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
              {(['Today', 'WTD', 'MTD'] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p}</button>
              ))}
            </div>
            {/* Location selector */}
            <select
              value={location || ''}
              onChange={(e) => setLocation(e.target.value as any || undefined)}
              className="text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-slate-600"
            >
              {locations.map((loc) => (
                <option key={loc.label} value={loc.value || ''}>{loc.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-sm">
              {['Off', '30s', '1m'].map((l, i) => (
                <button key={l} onClick={() => setRefreshInterval([0, 30000, 60000][i])} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${refreshInterval === [0, 30000, 60000][i] ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
              ))}
            </div>
            <button onClick={handleRefresh} disabled={isRefreshing} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors disabled:opacity-50 border border-slate-100 shadow-sm">
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-[#11141d] hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95">
              <span>Export Reports</span>
            </button>
          </div>
        </header>

        <main className="p-10 max-w-[1400px]">
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Ops Health' && renderOpsHealth()}
          {activeTab === 'Marketing' && renderMarketing()}
          {activeTab === 'Financials' && renderFinancials()}
        </main>
        
        <footer className="px-10 py-10 mt-auto border-t border-slate-100 bg-white/50">
           <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
               <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Operational Health</span>
                <span className={`text-xs font-bold uppercase tracking-tighter flex items-center ${isLiveData ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isLiveData ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {isLiveData ? 'Live' : 'Sample Data'}
                </span>
              </div>
              <div className="flex flex-col border-l border-slate-100 pl-6">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Data Feed</span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tighter">
                  {isLiveData ? `Toast POS • ${location ? locations.find(l => l.value === location)?.label : 'All Locations'}` : 'Demo Mode'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-[9px] font-black tracking-[0.3em] text-slate-300 uppercase select-none">
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
