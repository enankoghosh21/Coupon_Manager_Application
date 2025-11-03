import React, { useState, useMemo, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { ClipboardListIcon } from './icons/ClipboardListIcon';

interface AuditLogProps {
  logs: AuditLogEntry[];
}

const ITEMS_PER_PAGE = 25;

export const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const { paginatedLogs, totalPages, totalItems, startItem, endItem } = useMemo(() => {
    const total = logs.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const clampedCurrentPage = Math.max(1, Math.min(currentPage, pages || 1));
    const startIndex = (clampedCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
    const paginated = logs.slice(startIndex, endIndex);
    return { 
        paginatedLogs: paginated, 
        totalPages: pages, 
        totalItems: total,
        startItem: total > 0 ? startIndex + 1 : 0,
        endItem: endIndex
    };
  }, [currentPage, logs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto text-center">
        <ClipboardListIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800">No Activity Recorded</h3>
        <p className="text-slate-500 mt-1">The audit log is currently empty. System actions will be recorded here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">System Audit Log</h3>
        <p className="text-sm text-slate-500 mt-1">A record of significant actions performed within the application.</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Timestamp</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">User</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginatedLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 even:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {log.timestamp.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {log.userName} <span className="text-xs text-slate-500">({log.userRole})</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <div>
                <p className="text-sm text-slate-700">
                    Showing
                    <span className="font-medium"> {startItem} </span>
                    to
                    <span className="font-medium"> {endItem} </span>
                    of
                    <span className="font-medium"> {totalItems} </span>
                    results
                </p>
            </div>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-sm text-slate-700 px-2">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
