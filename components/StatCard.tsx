
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
    <div className="glass-card p-6 rounded-2xl flex flex-col relative group cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
            {icon || <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>}
          </div>
          <span className="text-sm font-semibold text-slate-600 tracking-tight">{label}</span>
        </div>
        <button className="text-slate-300 hover:text-slate-500 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>
      </div>
      
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isCurrency ? `$${Number(value).toLocaleString()}` : value}{isPercent ? '%' : ''}
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">Compare with last month</p>
        </div>
        
        <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
          isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {isPositive ? '+' : ''}{change}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
