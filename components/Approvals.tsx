import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ApprovalRequest, ApprovalStatus, Coupon } from '../types';
import { ApprovalIcon } from './icons/ApprovalIcon';
import { TicketIcon } from './icons/TicketIcon';

// Add type declarations for window objects from CDNs
declare global {
    interface Window {
        XLSX: any;
    }
}

interface ApprovalsProps {
  approvalRequests: ApprovalRequest[];
  onAction: (requestId: string, action: 'approve' | 'deny') => Coupon | null;
  onBulkAction: (requestIds: string[], action: 'approve' | 'deny') => { approvedCoupons: Coupon[], failedRequestIds: string[] };
}

type Filter = 'pending' | 'all';
type BulkResult = { approvedCoupons: Coupon[], failedRequestIds: string[] };

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

const getStatusBadge = (status: ApprovalStatus) => {
    switch(status) {
        case ApprovalStatus.PENDING:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
        case ApprovalStatus.APPROVED:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
        case ApprovalStatus.DENIED:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Denied</span>;
        default:
            return null;
    }
}

export const Approvals: React.FC<ApprovalsProps> = ({ approvalRequests, onAction, onBulkAction }) => {
    const [filter, setFilter] = useState<Filter>('pending');
    const [approvedCoupon, setApprovedCoupon] = useState<Coupon | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
    const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    
    const { filteredRequests, pendingRequestIds } = useMemo(() => {
        const sorted = [...approvalRequests].sort((a,b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        const pendingIds = sorted.filter(r => r.status === ApprovalStatus.PENDING).map(r => r.id);
        if (filter === 'pending') {
            return {
                filteredRequests: sorted.filter(r => r.status === ApprovalStatus.PENDING),
                pendingRequestIds: pendingIds
            };
        }
        return {
            filteredRequests: sorted,
            pendingRequestIds: pendingIds
        };
    }, [approvalRequests, filter]);

    // Clear selection when filter changes
    useEffect(() => {
        setSelectedRequests(new Set());
        setBulkResult(null);
    }, [filter]);

    // FIX: Use a ref and useEffect to set the indeterminate property on the "select all" checkbox, as it's not a standard React prop.
    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = selectedRequests.size > 0 && selectedRequests.size < pendingRequestIds.length;
        }
    }, [selectedRequests, pendingRequestIds]);

    const handleSelect = (requestId: string) => {
        const newSelection = new Set(selectedRequests);
        if (newSelection.has(requestId)) {
            newSelection.delete(requestId);
        } else {
            newSelection.add(requestId);
        }
        setSelectedRequests(newSelection);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRequests(new Set(pendingRequestIds));
        } else {
            setSelectedRequests(new Set());
        }
    };

    const handleBulkAction = (action: 'approve' | 'deny') => {
        if (selectedRequests.size === 0) return;
        const result = onBulkAction(Array.from(selectedRequests), action);
        setBulkResult(result);
        setSelectedRequests(new Set());
    };

    const handleExport = () => {
        if (!bulkResult || bulkResult.approvedCoupons.length === 0) return;
        
        try {
            const reportData = bulkResult.approvedCoupons.map(coupon => ({
                "Coupon Code": coupon.code,
                "Promo Name": coupon.promoName,
                "Coupon Type": coupon.type,
                "Agent Name": coupon.generationRecord!.agentName,
                "Case ID": coupon.generationRecord!.caseId,
                "User ID": coupon.generationRecord!.userId,
                "Order Number": coupon.generationRecord!.orderNumber || 'N/A',
                "Reason": coupon.generationRecord!.reason,
                "Generated At": coupon.generationRecord!.generatedAt.toLocaleString(),
            }));

            const wb = window.XLSX.utils.book_new();
            const ws = window.XLSX.utils.json_to_sheet(reportData);
            window.XLSX.utils.book_append_sheet(wb, ws, "Bulk Approved Coupons");
            window.XLSX.writeFile(wb, "bulk_approval_report.xlsx");
        } catch (error) {
            console.error("Failed to export bulk approval report:", error);
            alert("An error occurred while trying to export the data.");
        }
    };

    const handleApprove = (requestId: string) => {
        setBulkResult(null); // Clear any bulk results
        const coupon = onAction(requestId, 'approve');
        if (coupon) {
            setApprovedCoupon(coupon);
        }
    };
    
    const handleDeny = (requestId: string) => {
        setBulkResult(null);
        onAction(requestId, 'deny');
    };

    const copyToClipboard = () => {
        if (approvedCoupon) {
            navigator.clipboard.writeText(approvedCoupon.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    const closeModal = () => {
        setApprovedCoupon(null);
        setCopied(false);
    };

    if (approvalRequests.length === 0) {
        return (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto text-center">
            <ApprovalIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800">No Approval Requests</h3>
            <p className="text-slate-500 mt-1">There are currently no pending or historical approval requests.</p>
          </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Coupon Approval Requests</h3>
                    {selectedRequests.size > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-slate-600">{selectedRequests.size} selected</span>
                            <button onClick={() => handleBulkAction('approve')} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-colors">Bulk Approve</button>
                            <button onClick={() => handleBulkAction('deny')} className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors">Bulk Deny</button>
                        </div>
                    )}
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-slate-500">Show:</span>
                    <FilterButton onClick={() => setFilter('pending')} isActive={filter === 'pending'}>Pending</FilterButton>
                    <FilterButton onClick={() => setFilter('all')} isActive={filter === 'all'}>All</FilterButton>
                </div>
            </div>

            {bulkResult && (
                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold">Bulk Action Complete</p>
                            <p className="text-sm">
                                {bulkResult.approvedCoupons.length} request(s) approved. {bulkResult.failedRequestIds.length} request(s) failed/denied.
                            </p>
                            {bulkResult.approvedCoupons.length > 0 && (
                                <button onClick={handleExport} className="mt-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700 border border-transparent shadow-sm">
                                    Export Approved Coupons
                                </button>
                            )}
                        </div>
                        <button onClick={() => setBulkResult(null)} className="font-bold text-xl leading-none text-indigo-500 hover:text-indigo-700">&times;</button>
                    </div>
                </div>
            )}

            {filteredRequests.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-slate-500">
                        {filter === 'pending' ? 'There are no pending approval requests.' : 'There are no requests to display.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {filter === 'pending' && (
                                    <th scope="col" className="p-4">
                                        <input
                                            ref={selectAllCheckboxRef}
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            onChange={handleSelectAll}
                                            checked={pendingRequestIds.length > 0 && selectedRequests.size === pendingRequestIds.length}
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Agent</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Request Details</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Coupon Requested</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-slate-200">
                            {filteredRequests.map(req => (
                                <tr key={req.id} className={`hover:bg-slate-50 even:bg-slate-50 ${selectedRequests.has(req.id) ? 'bg-indigo-50' : ''}`}>
                                     {filter === 'pending' && (
                                        <td className="p-4">
                                            {req.status === ApprovalStatus.PENDING && (
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedRequests.has(req.id)}
                                                    onChange={() => handleSelect(req.id)}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-4 py-4 whitespace-nowrap">{getStatusBadge(req.status)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{req.agentName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                        <div><strong>User ID:</strong> {req.userId}</div>
                                        <div><strong>Order #:</strong> {req.orderNumber || 'N/A'}</div>
                                        <div><strong>Case ID:</strong> {req.caseId}</div>
                                    </td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                        <div><strong>Type:</strong> {req.couponType}</div>
                                        <div><strong>Promo:</strong> {req.promoName}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{req.requestedAt.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        {req.status === ApprovalStatus.PENDING ? (
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => handleApprove(req.id)} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-colors">Approve</button>
                                                <button onClick={() => handleDeny(req.id)} className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors">Deny</button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500">Resolved</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                    </table>
                </div>
            )}

            {approvedCoupon && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="bg-white p-6 rounded-lg shadow-xl text-center w-full max-w-sm m-4 transform transition-all">
                        <h3 id="modal-title" className="text-lg font-semibold text-slate-800 mb-4">Coupon Approved & Generated</h3>
                        <div className="relative bg-gradient-to-br from-indigo-50 to-white border-2 border-dashed border-indigo-200 rounded-lg p-4 my-2">
                            <TicketIcon className="w-10 h-10 mx-auto text-indigo-500 mb-2" />
                            <p className="text-2xl font-bold font-mono tracking-widest text-slate-900">{approvedCoupon.code}</p>
                            <p className="text-sm font-medium text-slate-600 mt-1">
                                {approvedCoupon.promoName}
                            </p>
                        </div>
                        {approvedCoupon.expiresAt && (
                            <p className="text-xs text-slate-500 mb-4">
                                Expires on: <span className="font-medium">{approvedCoupon.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' })}</span>
                            </p>
                        )}
                        <button onClick={copyToClipboard} className="w-full mb-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
                            {copied ? 'Copied!' : 'Copy Code'}
                        </button>
                        <button onClick={closeModal} className="w-full py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};