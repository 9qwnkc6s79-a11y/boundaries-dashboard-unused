
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { RevenueMix } from '../types';

interface RevenueMixToggleProps {
  data: RevenueMix[];
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6'];

const RevenueMixToggle: React.FC<RevenueMixToggleProps> = ({ data }) => {
  const [showMix, setShowMix] = useState(false);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-zinc-100">Revenue Quality Mix</h3>
        <button
          onClick={() => setShowMix(!showMix)}
          className="text-xs font-medium bg-[#1a1a1f] hover:bg-[#27272a] text-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          {showMix ? 'Hide Mix' : 'Show Breakdown'}
        </button>
      </div>

      {showMix ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                nameKey="channel"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#f4f4f5' }}
                itemStyle={{ color: '#a1a1aa' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {data.map((item, idx) => (
            <div key={item.channel} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }}></div>
                <span className="text-sm text-zinc-400 font-medium">{item.channel}</span>
              </div>
              <span className="text-sm font-bold text-zinc-200">{item.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RevenueMixToggle;
