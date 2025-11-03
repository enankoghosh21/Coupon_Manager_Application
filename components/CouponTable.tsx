import React, { useState, useMemo, useEffect } from 'react';
import { Coupon, CouponStatus } from '../types';

interface CouponTableProps {
  coupons: Coupon[];
  showFilters?: boolean;
  title?: string;
  showExportButton?: boolean;
  onExport?: () => void;
}

const ITEMS_PER_PAGE = 25;

const FilterButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, children }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        isActive
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
      }`}
    >
      {children}
    </button>
  );
};

export const CouponTable: React.FC<CouponTableProps> = ({ coupons, showFilters = true, title = "Coupon Inventory", showExportButton = false, onExport = () => {} }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const uniqueTypes = useMemo(() => {
    return ['all', ...Array.from(new Set(coupons.map(c => c.type)))];
  }, [coupons]);
  
  const filteredCoupons = useMemo(() => {
    if (!showFilters) return coupons;

    let filtered = coupons;

    // Status filter
    if (statusFilter === 'available') {
        filtered = filtered.filter((c) => c.status === CouponStatus.AVAILABLE);
    } else if (statusFilter === 'used') {
        filtered = filtered.filter((c) => c.status === CouponStatus.USED);
    }

    // Type filter
    if (typeFilter !== 'all') {
        filtered = filtered.filter(c => c.type === typeFilter);
    }

    return filtered;
  }, [coupons, statusFilter, typeFilter, showFilters]);

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter]);
  
  const { paginatedCoupons, totalPages, totalItems, startItem, endItem } = useMemo(() => {
    const total = filteredCoupons.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const clampedCurrentPage = Math.max(1, Math.min(currentPage, pages || 1));
    const startIndex = (clampedCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
    const paginated = filteredCoupons.slice(startIndex, endIndex);
    return { 
        paginatedCoupons: paginated, 
        totalPages: pages, 
        totalItems: total,
        startItem: total > 0 ? startIndex + 1 : 0,
        endItem: endIndex
    };
  }, [currentPage, filteredCoupons]);

  const handleSetStatusFilter = (newFilter: 'all' | 'available' | 'used') => {
    setStatusFilter(newFilter);
  };

  const getStatus = (coupon: Coupon) => {
    const now = new Date();
    if (coupon.status === CouponStatus.USED) {
        return { text: 'Used', className: 'bg-red-100 text-red-800' };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
        return { text: 'Expired', className: 'bg-yellow-100 text-yellow-800' };
    }
    if (coupon.beginsAt > now) {
        return { text: 'Scheduled', className: 'bg-blue-100 text-blue-800' };
    }
    return { text: 'Available', className: 'bg-green-100 text-green-800' };
  }

  if (coupons.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto mt-6 text-center">
        <p className="text-slate-500">
            {showFilters ? 'No coupons have been uploaded yet.' : 'No coupons have been used yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {showExportButton && (
                <button
                    onClick={onExport}
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700 border border-transparent shadow-sm"
                >
                    Export
                </button>
            )}
        </div>
        {showFilters && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-slate-500">Status:</span>
                    <FilterButton onClick={() => handleSetStatusFilter('all')} isActive={statusFilter === 'all'}>All</FilterButton>
                    <FilterButton onClick={() => handleSetStatusFilter('available')} isActive={statusFilter === 'available'}>Available</FilterButton>
                    <FilterButton onClick={() => handleSetStatusFilter('used')} isActive={statusFilter === 'used'}>Used</FilterButton>
                </div>
                 <div className="flex items-center space-x-2">
                    <label htmlFor="type-filter" className="text-sm font-medium text-slate-500">Type:</label>
                    <select
                        id="type-filter"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="form-select w-full sm:w-auto"
                    >
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>
                                {type === 'all' ? 'All Types' : type}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        )}
      </div>
      {filteredCoupons.length === 0 ? (
         <div className="text-center py-8">
            <p className="text-slate-500">
                {showFilters ? 'No coupons match the current filters.' : 'There is no usage history to display.'}
            </p>
        </div>
      ) : (
      <>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Coupon Code</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Promo Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Begins At (UTC)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Expires At (UTC)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Usage Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedCoupons.map((coupon) => {
                  const statusInfo = getStatus(coupon);
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50 even:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.className}`}>
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-700">{coupon.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{coupon.promoName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{coupon.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{coupon.beginsAt.toLocaleString('en-US', { timeZone: 'UTC' })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{coupon.expiresAt ? coupon.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' }) : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {coupon.status === CouponStatus.USED && coupon.generationRecord ? (
                          <div className="group relative">
                              <span>Case: {coupon.generationRecord.caseId}</span>
                              <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                  <strong>Agent:</strong> {coupon.generationRecord.agentName}<br/>
                                  <strong>User ID:</strong> {coupon.generationRecord.userId}<br/>
                                  <strong>Order:</strong> {coupon.generationRecord.orderNumber || 'N/A'}<br/>
                                  <strong>Reason:</strong> {coupon.generationRecord.reason}<br/>
                                  <strong>Date:</strong> {coupon.generationRecord.generatedAt.toLocaleString()}
                              </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
              })}
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
      </>
      )}
    </div>
  );
};