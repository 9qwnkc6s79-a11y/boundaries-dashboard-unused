
import React from 'react';
import { ShiftLeadData } from '../types';

interface ShiftLeadTableProps {
  leads: ShiftLeadData[];
}

const ShiftLeadTable: React.FC<ShiftLeadTableProps> = ({ leads }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr className="bg-white">
            <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Name</th>
            <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Role</th>
            <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Performance</th>
            <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
            <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-50">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-8 py-5 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 mr-3">
                    {lead.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{lead.name}</span>
                </div>
              </td>
              <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500 font-medium italic">Shift Lead</td>
              <td className="px-8 py-5 whitespace-nowrap">
                <div className="text-sm font-bold text-slate-900">${lead.salesPerLaborHour} SPLH</div>
                <div className="text-[10px] text-slate-400">{lead.avgTripTime}s avg trip</div>
              </td>
              <td className="px-8 py-5 whitespace-nowrap">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>
              </td>
              <td className="px-8 py-5 whitespace-nowrap">
                <button className="text-slate-300 hover:text-blue-500 transition-colors">
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
