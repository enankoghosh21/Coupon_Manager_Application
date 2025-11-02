import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Uploader } from './components/Uploader';
import { Generator } from './components/Generator';
import { CouponTable } from './components/CouponTable';
import { Dashboard } from './components/Dashboard';
import { Approvals } from './components/Approvals';
import { Accounts } from './components/Accounts';
import { Coupon, CouponStatus, GenerationRecord, SkippedCoupon, ApprovalRequest, ApprovalStatus, User, UserRole } from './types';
import { LogoIcon } from './components/icons/LogoIcon';
import { ApprovalIcon } from './components/icons/ApprovalIcon';
import { UserIcon } from './components/icons/UserIcon';
import { generateMockCoupons } from './utils/mockData';

type Tab = 'dashboard' | 'generator' | 'approvals' | 'accounts' | 'manage' | 'history';

// Add type declarations for window objects from CDNs
declare global {
    interface Window {
        XLSX: any;
    }
}

const STORAGE_KEY = 'couponManagerData_v4';

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

const NewTypesModal: React.FC<{
    newTypes: string[], 
    onConfirm: () => void, 
    onCancel: () => void 
}> = ({ newTypes, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md m-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">New Coupon Types Detected</h3>
                <p className="text-sm text-slate-600 mb-4">The uploaded file contains coupon types that are not in the master list. Do you want to add them and proceed with the upload?</p>
                <div className="space-y-2 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-md max-h-40 overflow-y-auto">
                    {newTypes.map(type => (
                        <p key={type} className="font-mono text-sm text-slate-700">{type}</p>
                    ))}
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                        Cancel Upload
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                        Add Types & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [couponTypes, setCouponTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [uploadReport, setUploadReport] = useState<{ newCount: number; skipped: SkippedCoupon[] } | null>(null);
  const [newTypesConfirmation, setNewTypesConfirmation] = useState<{ newTypes: string[], uploadData: { newCoupons: Coupon[], skippedCoupons: SkippedCoupon[] } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load data from localStorage on initial render
  useEffect(() => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const data = JSON.parse(storedData);
            const rehydrated = rehydrateCoupons(data.coupons || []);
            setCoupons(rehydrated);
            setApprovalRequests(rehydrateApprovalRequests(data.approvalRequests || []));
            
            let loadedUsers = data.users || [];
            // One-time migration from managerId to managerIds
            const needsMigration = loadedUsers.some((u: any) => u.managerId);
            if (needsMigration) {
                console.log("Migrating user data to support multiple managers...");
                loadedUsers = loadedUsers.map((u: any) => {
                    if (u.managerId && !u.managerIds) {
                        const { managerId, ...rest } = u;
                        return { ...rest, managerIds: [managerId] };
                    }
                    return u;
                });
            }
            setUsers(loadedUsers);

            const loadedTypes = data.couponTypes || [];
            // If historical types exist, use them. Otherwise, derive from loaded coupons.
            if (loadedTypes.length > 0) {
                 setCouponTypes(loadedTypes);
            } else {
                 const derivedTypes = [...new Set(rehydrated.map(c => c.type))].sort();
                 setCouponTypes(derivedTypes);
            }

            setCurrentUser(loadedUsers.length > 0 ? loadedUsers[0] : null);
        } else {
            // First time setup: create a default super admin
            const superAdmin: User = { id: '1', firstName: 'Super', lastName: 'Admin', workId: 'SA001', email: 'superadmin@example.com', role: UserRole.SUPER_ADMIN, isActive: true };
            setUsers([superAdmin]);
            setCurrentUser(superAdmin);
        }
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
        if (users.length > 0) { // Only save if there's data to prevent overwriting on error
            const dataToStore = { coupons, approvalRequests, users, couponTypes };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        }
    } catch (error) {
      console.error("Failed to save data to localStorage", error);
    }
  }, [coupons, approvalRequests, users, couponTypes]);


  useEffect(() => {
      // Set default tab when user changes
      if (currentUser) {
          if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.MANAGER) {
            setActiveTab('dashboard');
          } else {
            setActiveTab('generator');
          }
      }
  }, [currentUser]);

  useEffect(() => {
    // Redirect managers away from the manage tab if they land on it.
    if (currentUser?.role === UserRole.MANAGER && activeTab === 'manage') {
        setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const isPrivilegedUser = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MANAGER;

  const completeUpload = (uploadResult: { newCoupons: Coupon[]; skippedCoupons: SkippedCoupon[] }) => {
    const { newCoupons, skippedCoupons } = uploadResult;
    setCoupons(prevCoupons => [...prevCoupons, ...newCoupons].sort((a,b) => a.code.localeCompare(b.code)));
    
    // Update the master list of coupon types
    const typesFromUpload = new Set(newCoupons.map(c => c.type));
    setCouponTypes(prevTypes => {
        const combined = new Set([...prevTypes, ...typesFromUpload]);
        return Array.from(combined).sort();
    });

    setUploadReport({ newCount: newCoupons.length, skipped: skippedCoupons });
  };

  const handleUpload = (uploadResult: { newCoupons: Coupon[]; skippedCoupons: SkippedCoupon[] }) => {
    const { newCoupons } = uploadResult;
    const typesFromUpload = new Set(newCoupons.map(c => c.type));
    const existingTypesSet = new Set(couponTypes);
    const newTypesFound = [...typesFromUpload].filter(t => !existingTypesSet.has(t));

    if (newTypesFound.length > 0 && isPrivilegedUser) {
        setNewTypesConfirmation({ newTypes: newTypesFound, uploadData: uploadResult });
    } else {
        completeUpload(uploadResult);
    }
  };

  const handleConfirmNewTypes = () => {
    if (!newTypesConfirmation) return;
    const { uploadData } = newTypesConfirmation;
    completeUpload(uploadData);
    setNewTypesConfirmation(null);
  };

  const handleGenerate = (details: Omit<GenerationRecord, 'generatedAt'>, type: string, promoName: string): Coupon | 'APPROVAL_REQUESTED' | null => {
    const { userId, orderNumber } = details;

    // Only check for duplicates if an order number is provided and not empty
    const isUserOrderPairUsed = orderNumber && orderNumber.trim() !== ''
        ? coupons.some(c =>
            c.status === CouponStatus.USED &&
            c.generationRecord?.userId.trim().toLowerCase() === userId.trim().toLowerCase() &&
            c.generationRecord?.orderNumber?.trim().toLowerCase() === orderNumber.trim().toLowerCase()
        )
        : false;

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
    const adminFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin';

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
            
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.APPROVED, resolvedAt: new Date(), resolvedBy: adminFullName };
            setApprovalRequests(updatedRequests);
            return generatedCoupon;
        } else {
            alert('No available coupons matching the request. The request will be denied.');
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: new Date(), resolvedBy: adminFullName };
            setApprovalRequests(updatedRequests);
            return null;
        }
    } else { // Deny
        updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: new Date(), resolvedBy: adminFullName };
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
    const adminFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin';
    const adminName = `${adminFullName} (Bulk)`;

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
                updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.APPROVED, resolvedAt: now, resolvedBy: adminName };
                approvedCouponsResult.push(generatedCoupon);
            } else {
                updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: now, resolvedBy: adminName, reason: 'No available coupon.' };
                failedRequestIdsResult.push(requestId);
            }
        } else { // Deny
            updatedRequests[requestIndex] = { ...request, status: ApprovalStatus.DENIED, resolvedAt: now, resolvedBy: adminName };
        }
    });

    setCoupons(updatedCoupons);
    setApprovalRequests(updatedRequests);

    return { approvedCoupons: approvedCouponsResult, failedRequestIds: failedRequestIdsResult };
  };

  const handleSaveUser = (userToSave: User) => {
    setUsers(prevUsers => {
        const userExists = prevUsers.some(u => u.id === userToSave.id);
        if (userExists) {
            return prevUsers.map(u => u.id === userToSave.id ? userToSave : u);
        } else {
            return [...prevUsers, userToSave];
        }
    });
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
  }

  const handleTeamAssignment = (agentId: string, managerId: string, action: 'assign' | 'unassign') => {
    setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === agentId) {
            const currentManagerIds = new Set(user.managerIds || []);
            if (action === 'assign') {
                currentManagerIds.add(managerId);
            } else {
                currentManagerIds.delete(managerId);
            }
            return { ...user, managerIds: Array.from(currentManagerIds) };
        }
        return user;
    }));
  };

  const handleCreateCouponType = (newType: string) => {
    setCouponTypes(prev => {
        const newTypes = new Set([...prev, newType.trim()]);
        return Array.from(newTypes).sort();
    });
  };

  const handleDeleteCouponType = (typeToDelete: string) => {
    if (window.confirm(`Are you sure you want to delete the type "${typeToDelete}"? This will also remove access for any agents assigned to it.`)) {
        setCouponTypes(prev => prev.filter(t => t !== typeToDelete));
        // Also remove access from all users
        setUsers(prevUsers => prevUsers.map(u => ({
            ...u,
            accessibleCouponTypes: u.accessibleCouponTypes?.filter(t => t !== typeToDelete)
        })));
    }
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
        const dataToSave = { coupons, approvalRequests, users, couponTypes };
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

    if (!window.confirm("Are you sure you want to load this data? This will overwrite all current coupons, requests, and user accounts.")) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const data = JSON.parse(text);
            const rehydratedCouponsList = rehydrateCoupons(data.coupons || []);
            const rehydratedRequestsList = rehydrateApprovalRequests(data.approvalRequests || []);
            const loadedUsers = data.users || [];

            setCoupons(rehydratedCouponsList);
            setApprovalRequests(rehydratedRequestsList);
            setUsers(loadedUsers);
            setCouponTypes(data.couponTypes || [...new Set(rehydratedCouponsList.map(c => c.type))].sort());

            if (loadedUsers.length > 0) {
              setCurrentUser(loadedUsers[0]);
            } else {
              const superAdmin: User = { id: '1', firstName: 'Super', lastName: 'Admin', workId: 'SA001', email: 'superadmin@example.com', role: UserRole.SUPER_ADMIN, isActive: true };
              setUsers([superAdmin]);
              setCurrentUser(superAdmin);
            }
            
            setUploadReport({ newCount: rehydratedCouponsList.length, skipped: [] });

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
    if (window.confirm("Are you sure? This will permanently delete all application data, including users and coupon types.")) {
        setCoupons([]);
        setApprovalRequests([]);
        setCouponTypes([]);
        // Keep the superadmin user
        const superAdmin: User = { id: '1', firstName: 'Super', lastName: 'Admin', workId: 'SA001', email: 'superadmin@example.com', role: UserRole.SUPER_ADMIN, isActive: true };
        setUsers([superAdmin]);
        setCurrentUser(superAdmin);
        localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleLoadMockData = () => {
    if (window.confirm("Are you sure? This will replace any current data with the sample dataset for testing.")) {
        const mockData = generateMockCoupons(500);
        setCoupons(mockData);
        setApprovalRequests([]);
        const derivedTypes = [...new Set(mockData.map(c => c.type))].sort();
        setCouponTypes(derivedTypes);
        alert("Sample data loaded successfully.");
    }
  };

  if (!currentUser) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <p className="text-slate-500">Loading user data...</p>
        </div>
    );
  }

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
                     {isPrivilegedUser && (
                        <div className="hidden sm:block border-l border-slate-200 pl-4">
                            <div className="flex items-center space-x-1">
                                <TabButton tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab}>Dashboard</TabButton>
                                <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate</TabButton>
                                <TabButton tabId="approvals" activeTab={activeTab} setActiveTab={setActiveTab}>
                                  <ApprovalIcon className="w-4 h-4 mr-2" />
                                  Approvals
                                  {pendingApprovalsCount > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-red-100 bg-red-600 rounded-full">{pendingApprovalsCount}</span>
                                  )}
                                </TabButton>
                                 <TabButton tabId="accounts" activeTab={activeTab} setActiveTab={setActiveTab}>
                                    <UserIcon className="w-4 h-4 mr-2" />
                                    Accounts
                                 </TabButton>
                                {currentUser.role === UserRole.SUPER_ADMIN && (
                                    <TabButton tabId="manage" activeTab={activeTab} setActiveTab={setActiveTab}>Manage</TabButton>
                                )}
                                <TabButton tabId="history" activeTab={activeTab} setActiveTab={setActiveTab}>History</TabButton>
                            </div>
                        </div>
                    )}
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
                        <label htmlFor="user-select" className="text-sm font-medium text-slate-600 sr-only">Current User:</label>
                        <select 
                            id="user-select" 
                            value={currentUser.id} 
                            onChange={(e) => {
                                const user = users.find(u => u.id === e.target.value);
                                if (user) setCurrentUser(user);
                            }}
                            className="form-select !py-1.5"
                        >
                          {users.map(user => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.role})</option>)}
                        </select>
                    </div>
                </div>
            </div>
             {isPrivilegedUser && (
                 <div className="sm:hidden py-2 border-t border-slate-200">
                    <div className="flex items-center justify-center space-x-1 flex-wrap gap-1">
                        <TabButton tabId="dashboard" activeTab={activeTab} setActiveTab={setActiveTab}>Dashboard</TabButton>
                        <TabButton tabId="generator" activeTab={activeTab} setActiveTab={setActiveTab}>Generate</TabButton>
                         <TabButton tabId="approvals" activeTab={activeTab} setActiveTab={setActiveTab}>
                          Approvals
                          {pendingApprovalsCount > 0 && <span className="ml-1.5 inline-block w-2 h-2 bg-red-500 rounded-full"></span>}
                        </TabButton>
                        <TabButton tabId="accounts" activeTab={activeTab} setActiveTab={setActiveTab}>Accounts</TabButton>
                        {currentUser.role === UserRole.SUPER_ADMIN && (
                            <TabButton tabId="manage" activeTab={activeTab} setActiveTab={setActiveTab}>Manage</TabButton>
                        )}
                        <TabButton tabId="history" activeTab={activeTab} setActiveTab={setActiveTab}>History</TabButton>
                    </div>
                </div>
             )}
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

          {newTypesConfirmation && (
                <NewTypesModal 
                    newTypes={newTypesConfirmation.newTypes}
                    onConfirm={handleConfirmNewTypes}
                    onCancel={() => setNewTypesConfirmation(null)}
                />
            )}

          {!currentUser.isActive ? (
                <div className="text-center py-12">
                    <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
                    <p className="text-slate-600 mt-2">Your account is currently inactive. Please contact an administrator for assistance.</p>
                </div>
            ) : (
                <>
                    {/* Simplified View for Agents */}
                    {!isPrivilegedUser && (
                        <Generator onGenerate={handleGenerate} availableCoupons={availableCoupons} usedCoupons={usedCoupons} currentUser={currentUser} />
                    )}

                    {/* Tabbed View for Admin/Manager */}
                    {isPrivilegedUser && (
                        <>
                            {activeTab === 'dashboard' && <Dashboard coupons={coupons} />}
                            {activeTab === 'generator' && <Generator onGenerate={handleGenerate} availableCoupons={availableCoupons} usedCoupons={usedCoupons} currentUser={currentUser} />}
                            {activeTab === 'approvals' && <Approvals approvalRequests={approvalRequests} onAction={handleApprovalAction} onBulkAction={handleBulkAction} />}
                            {activeTab === 'accounts' && <Accounts users={users} currentUser={currentUser} couponTypes={couponTypes} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} onCreateCouponType={handleCreateCouponType} onDeleteCouponType={handleDeleteCouponType} onTeamAssignment={handleTeamAssignment} />}
                            {activeTab === 'manage' && currentUser.role === UserRole.SUPER_ADMIN && (
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
                            {activeTab === 'history' && (
                                <CouponTable 
                                    coupons={usedCoupons} 
                                    showFilters={false} 
                                    title="Coupon Usage History"
                                    showExportButton={true}
                                    onExport={handleExportUsageHistory}
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;