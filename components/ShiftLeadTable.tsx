
import React from 'react';
import { ShiftLeadData } from '../types';

interface ShiftLeadTableProps {
  leads: ShiftLeadData[];
}

const ShiftLeadTable: React.FC<ShiftLeadTableProps> = ({ leads }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#1e1e23]">
        <thead>
          <tr className="bg-[#0d0d10]">
            <th className="px-8 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Name</th>
            <th className="px-8 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Role</th>
            <th className="px-8 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Performance</th>
            <th className="px-8 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Status</th>
            <th className="px-8 py-4 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e23]">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-[#1a1a1f] transition-colors group">
              <td className="px-8 py-5 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 mr-3">
                    {lead.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-zinc-200">{lead.name}</span>
                </div>
              </td>
              <td className="px-8 py-5 whitespace-nowrap text-sm text-zinc-500 font-medium italic">Shift Lead</td>
              <td className="px-8 py-5 whitespace-nowrap">
                <div className="text-sm font-bold text-zinc-100 tabular-nums">${lead.salesPerLaborHour} SPLH</div>
                <div className="text-[10px] text-zinc-600">{lead.avgTripTime}s avg trip</div>
              </td>
              <td className="px-8 py-5 whitespace-nowrap">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>
              </td>
              <td className="px-8 py-5 whitespace-nowrap">
                <button className="text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ShiftLeadTable;
