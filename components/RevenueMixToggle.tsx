
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { RevenueMix } from '../types';

interface RevenueMixToggleProps {
  data: RevenueMix[];
}

const COLORS = ['#44403c', '#78716c', '#d6d3d1'];

const RevenueMixToggle: React.FC<RevenueMixToggleProps> = ({ data }) => {
  const [showMix, setShowMix] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-stone-800">Revenue Quality Mix</h3>
        <button 
          onClick={() => setShowMix(!showMix)}
          className="text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-1.5 rounded-lg transition-colors"
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
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
                <span className="text-sm text-stone-600 font-medium">{item.channel}</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{item.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RevenueMixToggle;
