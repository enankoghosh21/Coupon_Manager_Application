import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Uploader } from './components/Uploader';
import { Generator } from './components/Generator';
import { CouponTable } from './components/CouponTable';
import { Dashboard } from './components/Dashboard';
import { Approvals } from './components/Approvals';
import { Coupon, CouponStatus, GenerationRecord, SkippedCoupon, ApprovalRequest, ApprovalStatus } from './types';
import { LogoIcon } from './components/icons/LogoIcon';
import { ApprovalIcon } from './components/icons/ApprovalIcon';
import { generateMockCoupons } from './utils/mockData';

type Tab = 'dashboard' | 'generator' | 'approvals' | 'manage' | 'history';
type Role = 'agent' | 'admin';

// Add type declarations for window objects from CDNs
declare global {
    interface Window {
        XLSX: any;
    }
}

const STORAGE_KEY = 'couponManagerData';

// Helper function to rehydrate date objects after parsing from JSON
const rehydrateCoupons = (coupons: any[]): Coupon[] => {
    return coupons.map(coupon => ({
        ...coupon,
        beginsAt: new Date(coupon.beginsAt),
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : undefined,
        generationRecord: coupon.generationRecord ? {
            ...coupon.generationRecord,
            generatedAt: new Date(coupon.generationRecord.generatedAt)
        } : undefined
    }));
};

const rehydrateApprovalRequests = (requests: any[]): ApprovalRequest[] => {
    return requests.map(req => ({
        ...req,
        requestedAt: new Date(req.requestedAt),
        resolvedAt: req.resolvedAt ? new Date(req.resolvedAt) : undefined
    }));
};


const TabButton: React.FC<{tabId: Tab, activeTab: Tab, setActiveTab: (tab: Tab) => void, children: React.ReactNode}> = ({tabId, activeTab, setActiveTab, children}) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center ${
                isActive 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-200'
            }`}
        >
            {children}
        </button>
    )
}

const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [uploadReport, setUploadReport] = useState<{ newCount: number; skipped: SkippedCoupon[] } | null>(null);
  const [role, setRole] = useState<Role>('agent');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load data from localStorage on initial render
  useEffect(() => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const data = JSON.parse(storedData);
            setCoupons(rehydrateCoupons(data.coupons || []));
            setApprovalRequests(rehydrateApprovalRequests(data.approvalRequests || []));
        }
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
        const dataToStore = { coupons, approvalRequests };
        if (coupons.length > 0 || approvalRequests.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (error) {
      console.error("Failed to save data to localStorage", error);
    }
  }, [coupons, approvalRequests]);


  useEffect(() => {
      // Set default tab when role changes
      setActiveTab(role === 'admin' ? 'dashboard' : 'generator');
  }, [role]);

  const handleUpload = (uploadResult: { newCoupons: Coupon[]; skippedCoupons: SkippedCoupon[] }) => {
    const { newCoupons, skippedCoupons } = uploadResult;
    setCoupons(prevCoupons => [...prevCoupons, ...newCoupons].sort((a,b) => a.code.localeCompare(b.code)));
    setUploadReport({ newCount: newCoupons.length, skipped: skippedCoupons });
  };

  const handleGenerate = (details: Omit<GenerationRecord, 'generatedAt'>, type: string, promoName: string): Coupon | 'APPROVAL_REQUESTED' | null => {
    const { caseId, userId, orderNumber } = details;

    const isCaseIdUsed = coupons.some(c => 
        c.status === CouponStatus.USED && 
        c.generationRecord?.caseId.trim().toLowerCase() === caseId.trim().toLowerCase()
    );

    if (isCaseIdUsed) {
        throw new Error(`A coupon has already been generated for Case ID "${caseId}". Only one coupon per case is allowed.`);
    }
    
    const isUserOrderPairUsed = coupons.some(c =>
        c.status === CouponStatus.USED &&
        c.generationRecord?.userId.trim().toLowerCase() === userId.trim().toLowerCase() &&
        c.generationRecord?.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase()
    );

    if (isUserOrderPairUsed) {
        const newRequest: ApprovalRequest = {
            id: `${Date.now()}-${userId}`,
            status: ApprovalStatus.PENDING,
            requestedAt: new Date(),
            ...details,
            couponType: type,
            promoName: promoName,
        };
        setApprovalRequests(prev => [newRequest, ...prev]);
        return 'APPROVAL_REQUESTED';
    }
      
    const now = new Date();
    const availableCouponIndex = coupons.findIndex(
      (c) => c.status === CouponStatus.AVAILABLE && 
             c.beginsAt <= now &&
             (!c.expiresAt || c.expiresAt >= now) &&
             c.type === type &&
             c.promoName === promoName
    );

    if (availableCouponIndex === -1) {
      return null;
    }

    const updatedCoupons = [...coupons];
    const couponToUpdate = updatedCoupons[availableCouponIndex];

    const generationRecord: GenerationRecord = {
      ...details,
      generatedAt: now,
    };

    const generatedCoupon: Coupon = {
      ...couponToUpdate,
      status: CouponStatus.USED,
      generationRecord,
    };

    updatedCoupons[availableCouponIndex] = generatedCoupon;
    setCoupons(updatedCoupons);

    return generatedCoupon;
  };
  
  const handleApprovalAction = (requestId: string, action: 'approve' | 'deny'): Coupon | null => {
    const requestIndex = approvalRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return null;

    let updatedRequests = [...approvalRequests];
    const request = updatedRequests[requestIndex];

    if (action === 'approve') {
        const now = new Date();
        const availableCouponIndex = coupons.findIndex(c => 
            c.status === CouponStatus.AVAILABLE &&
            c.beginsAt <= now &&
            (!c.expiresAt || c.expiresAt >= now) &&
            c.type === request.couponType &&
            c.promoName === request.promoName
        );

        if (availableCouponIndex !== -1) {
            const updatedCoupons = [...coupons];
            const couponToUpdate = updatedCoupons[availableCouponIndex];

            const generationRecord: GenerationRecord = {
                caseId: request.caseId,
                userId: request.userId,
                agentName: request.agentName,
                orderNumber: request.orderNumber,
                reason: request.reason,
                generatedAt: new Date(),
            };

            const generatedCoupon: Coupon = {
                ...couponToUpdate,
                status: CouponStatus.USED,
                generationRecord,
            };

            updatedCoupons[availableCouponIndex] = generatedCoupon;
            setCoupons(updatedCoupons);
            
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.APPROVED, resolvedAt: new Date(), resolvedBy: 'Admin' };
            setApprovalRequests(updatedRequests);
            return generatedCoupon;
        } else {
            alert('No available coupons matching the request. The request will be denied.');
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: new Date(), resolvedBy: 'Admin' };
            setApprovalRequests(updatedRequests);
            return null;
        }
    } else { // Deny
        updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: new Date(), resolvedBy: 'Admin' };
        setApprovalRequests(updatedRequests);
        return null;
    }
  };

  const handleBulkAction = (requestIds: string[], action: 'approve' | 'deny'): { approvedCoupons: Coupon[], failedRequestIds: string[] } => {
    let updatedCoupons = [...coupons];
    let updatedRequests = [...approvalRequests];
    const approvedCouponsResult: Coupon[] = [];
    const failedRequestIdsResult: string[] = [];
    const now = new Date();

    requestIds.forEach(requestId => {
        const requestIndex = updatedRequests.findIndex(r => r.id === requestId);
        if (requestIndex === -1 || updatedRequests[requestIndex].status !== ApprovalStatus.PENDING) {
            return; 
        }

        const request = updatedRequests[requestIndex];

        if (action === 'approve') {
            const availableCouponIndex = updatedCoupons.findIndex(c => 
                c.status === CouponStatus.AVAILABLE &&
                c.beginsAt <= now &&
                (!c.expiresAt || c.expiresAt >= now) &&
                c.type === request.couponType &&
                c.promoName === request.promoName
            );

            if (availableCouponIndex !== -1) {
                const couponToUpdate = updatedCoupons[availableCouponIndex];
                const generationRecord: GenerationRecord = {
                    caseId: request.caseId,
                    userId: request.userId,
                    agentName: request.agentName,
                    orderNumber: request.orderNumber,
                    reason: request.reason,
                    generatedAt: now,
                };
                const generatedCoupon: Coupon = {
                    ...couponToUpdate,
                    status: CouponStatus.USED,
                    generationRecord,
                };
                
                updatedCoupons[availableCouponIndex] = generatedCoupon;
                updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.APPROVED, resolvedAt: now, resolvedBy: 'Admin (Bulk)' };
                approvedCouponsResult.push(generatedCoupon);
            } else {
                updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: now, resolvedBy: 'Admin (Bulk)', reason: 'No available coupon.' };
                failedRequestIdsResult.push(requestId);
            }
        } else { // Deny
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: now, resolvedBy: 'Admin (Bulk)' };
        }
    });

    setCoupons(updatedCoupons);
    setApprovalRequests(updatedRequests);

    return { approvedCoupons: approvedCouponsResult, failedRequestIds: failedRequestIdsResult };
  };
  
  const { stats, availableCoupons, usedCoupons, pendingApprovalsCount } = useMemo(() => {
      const now = new Date();
      const used = coupons.filter(c => c.status === CouponStatus.USED)
          .sort((a,b) => b.generationRecord!.generatedAt.getTime() - a.generationRecord!.generatedAt.getTime());

      const available = coupons.filter(c => 
          c.status === CouponStatus.AVAILABLE &&
          c.beginsAt <= now &&
          (!c.expiresAt || c.expiresAt >= now)
      );
      
      const usedCount = used.length;
      const totalCount = coupons.length;
      const availableCount = available.length;
      const pendingCount = approvalRequests.filter(r => r.status === ApprovalStatus.PENDING).length;

      return {
        stats: { available: availableCount, used: usedCount, total: totalCount },
        availableCoupons: available,
        usedCoupons: used,
        pendingApprovalsCount: pendingCount
      };
  }, [coupons, approvalRequests]);
  
  const handleExportUsageHistory = () => {
    try {
        const reportData = usedCoupons.map(coupon => ({
            "Coupon Code": coupon.code,
            "Promo Name": coupon.promoName,
            "Coupon Type": coupon.type,
            "Generated At": coupon.generationRecord!.generatedAt.toLocaleString(),
            "Agent Name": coupon.generationRecord!.agentName,
            "Case ID": coupon.generationRecord!.caseId,
            "User ID": coupon.generationRecord!.userId,
            "Order Number": coupon.generationRecord!.orderNumber || 'N/A',
            "Reason": coupon.generationRecord!.reason,
            "Promo Id": coupon.promoId,
            "Value": coupon.value,
        }));

        const wb = window.XLSX.utils.book_new();
        const ws = window.XLSX.utils.json_to_sheet(reportData);
        window.XLSX.utils.book_append_sheet(wb, ws, "Usage History");
        window.XLSX.writeFile(wb, "coupon_usage_history.xlsx");
    } catch (error) {
        console.error("Failed to export usage history:", error);
        alert("An error occurred while trying to export the data.");
    }
  };

  const handleSaveData = () => {
    try {
        const dataToSave = { coupons, approvalRequests };
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'coupon_manager_data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to save data:", error);
        alert("An error occurred while saving the data.");
    }
  };

  const handleLoadDataClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadDataChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Are you sure you want to load this data? This will overwrite all current coupons and approval requests in the application.")) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const data = JSON.parse(text);
            const rehydratedCoupons = rehydrateCoupons(data.coupons || []);
            const rehydratedRequests = rehydrateApprovalRequests(data.approvalRequests || []);
            setCoupons(rehydratedCoupons);
            setApprovalRequests(rehydratedRequests);
            setUploadReport({ newCount: rehydratedCoupons.length, skipped: [] });
        } catch (error) {
            console.error("Failed to load data:", error);
            alert("Failed to load or parse the data file. Please ensure it's a valid JSON backup from this application.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure? This will permanently delete all application data.")) {
        setCoupons([]);
        setApprovalRequests([]);
    }
  };

  const handleLoadMockData = () => {
    if (window.confirm("Are you sure? This will replace any current data with the sample dataset for testing.")) {
        const mockData = generateMockCoupons(500);
        setCoupons(mockData);
        setApprovalRequests([]);
        alert("Sample data loaded successfully.");
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <LogoIcon className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-xl font-bold text-slate-800">
                            Coupon Manager
                        </h1>
                    </div>
                    <div className="hidden sm:block border-l border-slate-200 pl-4">
                        <div className="flex items-center space-x-1">
                            {role === 'admin' ? (
                                <>
                                    <TabButton tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab}>Dashboard</TabButton>
                                    <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate</TabButton>
                                    <TabButton tabId="approvals" activeTab={activeTab} setActiveTab={setActiveTab}>
                                      <ApprovalIcon className="w-4 h-4 mr-2" />
                                      Approvals
                                      {pendingApprovalsCount > 0 && (
                                        <span className="ml-2 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-red-100 bg-red-600 rounded-full">{pendingApprovalsCount}</span>
                                      )}
                                    </TabButton>
                                    <TabButton tabId="manage" activeTab={activeTab} setActiveTab={setActiveTab}>Manage</TabButton>
                                    <TabButton tabId="history" activeTab={activeTab} setActiveTab={setActiveTab}>History</TabButton>
                                </>
                            ) : (
                                <>
                                    <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate Coupon</TabButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="hidden lg:flex items-center space-x-6 text-sm">
                        <div className="flex items-center space-x-2">
                            <span className="block w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-slate-500">Available:</span>
                            <span className="font-semibold text-slate-700">{stats.available}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="block w-2 h-2 rounded-full bg-red-500"></span>
                            <span className="text-slate-500">Used:</span>
                            <span className="font-semibold text-slate-700">{stats.used}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="block w-2 h-2 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">Total:</span>
                            <span className="font-semibold text-slate-700">{stats.total}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="role-select" className="text-sm font-medium text-slate-600 sr-only">Role:</label>
                        <select 
                            id="role-select" 
                            value={role} 
                            onChange={(e) => setRole(e.target.value as Role)}
                            className="form-select !py-1.5"
                        >
                            <option value="agent">Agent</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
            </div>
             <div className="sm:hidden py-2 border-t border-slate-200">
                <div className="flex items-center justify-center space-x-1">
                     {role === 'admin' ? (
                        <>
                            <TabButton tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab}>Dashboard</TabButton>
                            <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate</TabButton>
                             <TabButton tabId="approvals" activeTab={activeTab} setActiveTab={setActiveTab}>
                              Approvals
                              {pendingApprovalsCount > 0 && <span className="ml-1.5 inline-block w-2 h-2 bg-red-500 rounded-full"></span>}
                            </TabButton>
                            <TabButton tabId="manage" activeTab={activeTab} setActiveTab={setActiveTab}>Manage</TabButton>
                            <TabButton tabId="history" activeTab={activeTab} setActiveTab={setActiveTab}>History</TabButton>
                        </>
                    ) : (
                        <>
                            <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate Coupon</TabButton>
                        </>
                    )}
                </div>
            </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {uploadReport && (
            <div className="max-w-3xl mx-auto mb-6 p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Upload Complete</p>
                    <p className="text-sm">
                        {uploadReport.newCount} new coupon(s) added. {uploadReport.skipped.length > 0 ? `${uploadReport.skipped.length} duplicate(s) were ignored.` : ''}
                    </p>
                  </div>
                  <button onClick={() => setUploadReport(null)} className="font-bold text-xl leading-none text-indigo-500 hover:text-indigo-700">&times;</button>
              </div>
              {uploadReport.skipped.length > 0 && (
                  <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium hover:underline">
                          View skipped duplicates
                      </summary>
                      <div className="mt-2 p-2 bg-white rounded border border-indigo-200 max-h-40 overflow-y-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                              <thead className="bg-slate-50">
                                  <tr>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-slate-500">Row</th>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-slate-500">Code</th>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-slate-500">Reason</th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-200">
                                  {uploadReport.skipped.map(item => (
                                      <tr key={item.rowNumber}>
                                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{item.rowNumber}</td>
                                          <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-600">{item.rowData['Coupon code']}</td>
                                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{item.reason}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </details>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && role === 'admin' && <Dashboard coupons={coupons} />}
          
          {activeTab === 'generator' && (
            <Generator onGenerate={handleGenerate} availableCoupons={availableCoupons} usedCoupons={usedCoupons} />
          )}

          {activeTab === 'approvals' && role === 'admin' && (
            <Approvals 
              approvalRequests={approvalRequests} 
              onAction={handleApprovalAction} 
              onBulkAction={handleBulkAction} 
            />
          )}

          {activeTab === 'manage' && role === 'admin' && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm w-full max-w-3xl mx-auto">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                          <h3 className="text-lg font-semibold text-slate-800">Data Management</h3>
                          <p className="text-sm text-slate-500 mt-1">Manage the application's coupon dataset.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          <button onClick={handleSaveData} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm">Save Backup</button>
                          <button onClick={handleLoadDataClick} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-slate-700 text-white hover:bg-slate-800 shadow-sm">Load Backup</button>
                          <button onClick={handleLoadMockData} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">Load Sample Data</button>
                          <button onClick={handleClearData} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700 shadow-sm">Clear All Data</button>
                          <input type="file" accept=".json" ref={fileInputRef} onChange={handleLoadDataChange} className="hidden" />
                      </div>
                  </div>
              </div>
              <Uploader onUpload={handleUpload} isLoading={false} existingCoupons={coupons} />
              <CouponTable coupons={coupons} showFilters={true} title="Coupon Inventory" />
            </div>
          )}

          {activeTab === 'history' && role === 'admin' && (
            <CouponTable 
                coupons={usedCoupons} 
                showFilters={false} 
                title="Coupon Usage History"
                showExportButton={true}
                onExport={handleExportUsageHistory}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;