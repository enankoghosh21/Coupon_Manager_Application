import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Uploader } from './components/Uploader';
import { Generator } from './components/Generator';
import { CouponTable } from './components/CouponTable';
import { Dashboard } from './components/Dashboard';
import { Coupon, CouponStatus, GenerationRecord, SkippedCoupon } from './types';

type Tab = 'dashboard' | 'generator' | 'manage' | 'history';
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


const TabButton: React.FC<{tabId: Tab, activeTab: Tab, setActiveTab: (tab: Tab) => void, children: React.ReactNode}> = ({tabId, activeTab, setActiveTab, children}) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    )
}

const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            return rehydrateCoupons(JSON.parse(storedData));
        }
    } catch (error) {
        console.error("Failed to parse coupons from localStorage", error);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [uploadReport, setUploadReport] = useState<{ newCount: number; skipped: SkippedCoupon[] } | null>(null);
  const [role, setRole] = useState<Role>('agent');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
    } catch (error) {
      console.error("Failed to save coupons to localStorage", error);
    }
  }, [coupons]);


  useEffect(() => {
      // Set default tab when role changes
      setActiveTab(role === 'admin' ? 'dashboard' : 'generator');
  }, [role]);

  const handleUpload = (uploadResult: { newCoupons: Coupon[]; skippedCoupons: SkippedCoupon[] }) => {
    const { newCoupons, skippedCoupons } = uploadResult;
    setCoupons(prevCoupons => [...prevCoupons, ...newCoupons].sort((a,b) => a.code.localeCompare(b.code)));
    setUploadReport({ newCount: newCoupons.length, skipped: skippedCoupons });
  };

  const handleGenerate = (details: Omit<GenerationRecord, 'generatedAt'>, type: string, promoName: string): Coupon | null => {
    const isCaseIdUsed = coupons.some(c => 
        c.status === CouponStatus.USED && 
        c.generationRecord?.caseId.trim().toLowerCase() === details.caseId.trim().toLowerCase()
    );

    if (isCaseIdUsed) {
        throw new Error(`A coupon has already been generated for Case ID "${details.caseId}". Only one coupon per case is allowed.`);
    }

    if (details.orderNumber && details.orderNumber.trim() !== '') {
      const isOrderNumberUsed = coupons.some(c =>
          c.status === CouponStatus.USED &&
          c.generationRecord?.orderNumber?.trim().toLowerCase() === details.orderNumber.trim().toLowerCase()
      );

      if (isOrderNumberUsed) {
          throw new Error(`A coupon has already been generated for Order Number "${details.orderNumber}".`);
      }
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
  
  const { stats, availableCoupons, usedCoupons } = useMemo(() => {
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

      return {
        stats: { available: availableCount, used: usedCount, total: totalCount },
        availableCoupons: available,
        usedCoupons: used
      };
  }, [coupons]);
  
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
            "Customer Email": coupon.generationRecord!.customerEmail,
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
        const dataStr = JSON.stringify(coupons, null, 2);
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

    if (!window.confirm("Are you sure you want to load this data? This will overwrite all current coupons in the application.")) {
        // Reset file input value to allow re-selection of the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const parsedData = JSON.parse(text);
            if (Array.isArray(parsedData)) {
                const rehydrated = rehydrateCoupons(parsedData);
                setCoupons(rehydrated);
                setUploadReport({ newCount: rehydrated.length, skipped: [] });
            } else {
                throw new Error("Invalid data format.");
            }
        } catch (error) {
            console.error("Failed to load data:", error);
            alert("Failed to load or parse the data file. Please ensure it's a valid JSON backup from this application.");
        } finally {
            // Reset file input value to allow re-selection of the same file
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    reader.readAsText(file);
  };


  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
                <span className="text-indigo-600">Coupon</span> Manager
            </h1>

            <div className="flex items-center space-x-4 order-3 sm:order-none">
                <div className="flex items-center space-x-2">
                    <label htmlFor="role-select" className="text-sm font-medium text-gray-700">Role:</label>
                    <select 
                        id="role-select" 
                        value={role} 
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="block w-full pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="agent">L1/L2 Agent</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center space-x-4 order-2 sm:order-last">
                <div className="text-sm">
                    <span className="font-semibold text-green-600">{stats.available}</span> Available
                </div>
                 <div className="text-sm">
                    <span className="font-semibold text-red-600">{stats.used}</span> Used
                </div>
                 <div className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-800">{stats.total}</span> Total
                </div>
            </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-6">
            <div className="bg-white p-1 rounded-lg shadow-sm flex space-x-1">
                {role === 'admin' ? (
                    <>
                        <TabButton tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab}>Dashboard</TabButton>
                        <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate Coupon</TabButton>
                        <TabButton tabId="manage" activeTab={activeTab} setActiveTab={setActiveTab}>Manage Coupons</TabButton>
                        <TabButton tabId="history" activeTab={activeTab} setActiveTab={setActiveTab}>Usage History</TabButton>
                    </>
                ) : (
                    <>
                        <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate Coupon</TabButton>
                    </>
                )}
            </div>
        </div>
        
        <div className="px-4 sm:px-0">
          {uploadReport && (
            <div className="max-w-2xl mx-auto mb-6 p-4 bg-blue-100 border border-blue-200 text-blue-800 rounded-lg shadow">
              <div className="flex justify-between items-start">
                  <p>
                      <strong>Upload Complete:</strong> {uploadReport.newCount} new coupon(s) added. {uploadReport.skipped.length > 0 ? `${uploadReport.skipped.length} duplicate(s) were ignored.` : ''}
                  </p>
                  <button onClick={() => setUploadReport(null)} className="font-bold text-xl leading-none">&times;</button>
              </div>
              {uploadReport.skipped.length > 0 && (
                  <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium hover:underline">
                          View skipped duplicates
                      </summary>
                      <div className="mt-2 p-2 bg-white rounded border border-blue-200 max-h-40 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                  {uploadReport.skipped.map(item => (
                                      <tr key={item.rowNumber}>
                                          <td className="px-2 py-1 whitespace-nowrap">{item.rowNumber}</td>
                                          <td className="px-2 py-1 whitespace-nowrap font-mono">{item.rowData['Coupon code']}</td>
                                          <td className="px-2 py-1 whitespace-nowrap">{item.reason}</td>
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
            <Generator onGenerate={handleGenerate} availableCoupons={availableCoupons} />
          )}

          {activeTab === 'manage' && role === 'admin' && (
            <>
              <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-2xl mx-auto mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                          <h3 className="text-xl font-semibold text-gray-800">Data Management</h3>
                          <p className="text-sm text-gray-500 mt-1">Save your current coupon data to a file or load it from a backup.</p>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                          <button onClick={handleSaveData} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700">Save</button>
                          <button onClick={handleLoadDataClick} className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-gray-600 text-white hover:bg-gray-700">Load</button>
                          <input type="file" accept=".json" ref={fileInputRef} onChange={handleLoadDataChange} className="hidden" />
                      </div>
                  </div>
              </div>
              <Uploader onUpload={handleUpload} isLoading={false} existingCoupons={coupons} />
              <CouponTable coupons={coupons} showFilters={true} title="Coupon Inventory" />
            </>
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