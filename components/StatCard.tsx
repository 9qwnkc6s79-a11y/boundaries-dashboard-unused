
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change: number;
  isCurrency?: boolean;
  isPercent?: boolean;
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, change, isCurrency, isPercent, icon
}) => {
  const isPositive = change > 0;

  return (
    <div className="glass-card glow-left p-6 rounded-2xl flex flex-col relative group cursor-pointer transition-all hover:border-zinc-700">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
            {icon || <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>}
          </div>
          <span className="text-sm font-semibold text-zinc-400 tracking-tight">{label}</span>
        </div>
        <button className="text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-black text-zinc-100 tracking-tight tabular-nums">
            {isCurrency ? `$${Number(value).toLocaleString()}` : value}{isPercent ? '%' : ''}
          </h3>
          <p className="text-[11px] text-zinc-600 mt-1.5 font-medium">vs prior period</p>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
          isPositive
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-rose-500/10 text-rose-400'
        }`}>
          <svg className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
          </svg>
          <span>{isPositive ? '+' : ''}{change}%</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
