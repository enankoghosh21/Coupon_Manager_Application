import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
import { UserIcon } from './icons/UserIcon';

interface AccountsProps {
  users: User[];
  currentUser: User;
  couponTypes: string[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onCreateCouponType: (type: string) => void;
  onDeleteCouponType: (type: string) => void;
  onTeamAssignment: (agentId: string, managerId: string, action: 'assign' | 'unassign') => void;
}

const UserFormModal: React.FC<{
    userToEdit?: User | null;
    currentUser: User;
    allCouponTypes: string[];
    activeManagers: User[];
    onSave: (user: User) => void;
    onClose: () => void;
    existingEmails: string[];
}> = ({ userToEdit, currentUser, allCouponTypes, activeManagers, onSave, onClose, existingEmails }) => {
    const isNewUser = !userToEdit;
    const [firstName, setFirstName] = useState(userToEdit?.firstName || '');
    const [lastName, setLastName] = useState(userToEdit?.lastName || '');
    const [workId, setWorkId] = useState(userToEdit?.workId || '');
    const [email, setEmail] = useState(userToEdit?.email || '');
    const [role, setRole] = useState(userToEdit?.role || UserRole.L1_AGENT);
    const [isActive, setIsActive] = useState(userToEdit ? userToEdit.isActive : true);
    const [accessibleTypes, setAccessibleTypes] = useState<Set<string>>(new Set(userToEdit?.accessibleCouponTypes || []));
    const [managerIds, setManagerIds] = useState<Set<string>>(new Set(userToEdit?.managerIds || []));
    const [error, setError] = useState('');

    const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
    const isManager = currentUser.role === UserRole.MANAGER;
    // Check if the user being edited is actually on the current manager's team
    const isTeamMember = userToEdit && userToEdit.managerIds?.includes(currentUser.id);

    const canEditCoreInfo = isSuperAdmin;
    const canEditPermissions = isSuperAdmin || (isManager && !!isTeamMember);

    const isAgentRole = useMemo(() => [UserRole.L1_AGENT, UserRole.L2_AGENT, UserRole.CMT, UserRole.L4].includes(role), [role]);

    const handleTypeAccessChange = (type: string) => {
        setAccessibleTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    };
    
    const handleManagerSelectionChange = (managerId: string) => {
        setManagerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(managerId)) {
                newSet.delete(managerId);
            } else {
                newSet.add(managerId);
            }
            return newSet;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (canEditCoreInfo) {
            if (!firstName.trim() || !lastName.trim() || !workId.trim() || !email.trim()) {
                setError('All name, work ID, and email fields are required.');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                setError('Please enter a valid email address.');
                return;
            }

            const normalizedEmail = email.trim().toLowerCase();
            if (isNewUser && existingEmails.includes(normalizedEmail)) {
                setError('This email address is already in use.');
                return;
            }
        }

        if (isAgentRole && managerIds.size === 0 && canEditCoreInfo) {
            setError('At least one active manager must be selected for this role.');
            return;
        }

        onSave({
            id: userToEdit?.id || `${Date.now()}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            workId: workId.trim(),
            email: email.trim(),
            role,
            isActive,
            accessibleCouponTypes: isAgentRole ? Array.from(accessibleTypes) : [],
            managerIds: isAgentRole ? Array.from(managerIds) : [],
        });
        onClose();
    };
    
    const availableRoles = Object.values(UserRole);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md m-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">{isNewUser ? 'Create New User' : 'Edit User'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                            <input
                                type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                disabled={!canEditCoreInfo} className={`form-input ${!canEditCoreInfo ? 'bg-slate-100' : ''}`}
                            />
                        </div>
                         <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                            <input
                                type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)}
                                disabled={!canEditCoreInfo} className={`form-input ${!canEditCoreInfo ? 'bg-slate-100' : ''}`}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            disabled={!canEditCoreInfo && !isNewUser} className={`form-input ${!canEditCoreInfo && !isNewUser ? 'bg-slate-100' : ''}`}
                        />
                    </div>
                     <div>
                        <label htmlFor="workId" className="block text-sm font-medium text-slate-700 mb-1">Work ID</label>
                        <input
                            type="text" id="workId" value={workId} onChange={(e) => setWorkId(e.target.value)}
                            disabled={!canEditCoreInfo} className={`form-input ${!canEditCoreInfo ? 'bg-slate-100' : ''}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                            disabled={!canEditCoreInfo} className={`form-select ${!canEditCoreInfo ? 'bg-slate-100' : ''}`}
                        >
                            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {isAgentRole && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Managers</label>
                            {activeManagers.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-md">
                                    {activeManagers.map(manager => (
                                        <label key={manager.id} className="flex items-center space-x-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={managerIds.has(manager.id)}
                                                onChange={() => handleManagerSelectionChange(manager.id)}
                                                disabled={!canEditCoreInfo}
                                                className="form-checkbox h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                            />
                                            <span>{manager.firstName} {manager.lastName}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">No active managers available to assign.</p>
                            )}
                        </div>
                    )}

                    {isAgentRole && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Coupon Type Access</label>
                            {allCouponTypes.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-md">
                                    {allCouponTypes.map(type => (
                                        <label key={type} className="flex items-center space-x-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={accessibleTypes.has(type)}
                                                onChange={() => handleTypeAccessChange(type)}
                                                disabled={!canEditPermissions}
                                                className="form-checkbox h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:bg-slate-200"
                                            />
                                            <span>{type}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">No coupon types have been defined yet.</p>
                            )}
                        </div>
                    )}
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center">
                                <input type="radio" name="status" checked={isActive} onChange={() => setIsActive(true)} disabled={!canEditPermissions} className="form-radio h-4 w-4 text-indigo-600"/>
                                <span className="ml-2 text-sm text-slate-600">Active</span>
                            </label>
                            <label className="flex items-center">
                                <input type="radio" name="status" checked={!isActive} onChange={() => setIsActive(false)} disabled={!canEditPermissions} className="form-radio h-4 w-4 text-indigo-600"/>
                                <span className="ml-2 text-sm text-slate-600">Inactive</span>
                            </label>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="pt-4 flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CouponTypeManager: React.FC<{
    couponTypes: string[];
    onCreate: (type: string) => void;
    onDelete: (type: string) => void;
}> = ({ couponTypes, onCreate, onDelete }) => {
    const [newType, setNewType] = useState('');

    const handleAdd = () => {
        if (newType.trim() && !couponTypes.includes(newType.trim())) {
            onCreate(newType.trim());
            setNewType('');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto mt-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Manage Coupon Types</h3>
            <div className="flex items-center gap-2 mb-4">
                <input 
                    type="text" 
                    value={newType} 
                    onChange={e => setNewType(e.target.value)} 
                    placeholder="Enter new coupon type"
                    className="form-input flex-grow"
                />
                <button onClick={handleAdd} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">Add Type</button>
            </div>
             <div className="space-y-2 max-h-48 overflow-y-auto">
                {couponTypes.length > 0 ? couponTypes.map(type => (
                    <div key={type} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                        <span className="text-sm text-slate-700">{type}</span>
                        <button onClick={() => onDelete(type)} className="text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
                    </div>
                )) : <p className="text-sm text-slate-500 text-center py-4">No coupon types defined.</p>}
            </div>
        </div>
    );
};

export const Accounts: React.FC<AccountsProps> = ({ users, currentUser, couponTypes, onSaveUser, onDeleteUser, onCreateCouponType, onDeleteCouponType, onTeamAssignment }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const { usersToDisplay, activeManagers, assignableAgents } = useMemo(() => {
        const sortedUsers = [...users].sort((a,b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
        
        const managers = sortedUsers.filter(u => u.role === UserRole.MANAGER && u.isActive);
        const agentRoles = [UserRole.L1_AGENT, UserRole.L2_AGENT, UserRole.CMT, UserRole.L4];
        
        let displayUsers: User[] = [];
        if (currentUser.role === UserRole.SUPER_ADMIN) {
            displayUsers = sortedUsers;
        } else if (currentUser.role === UserRole.MANAGER) {
            displayUsers = sortedUsers.filter(u => u.managerIds?.includes(currentUser.id));
        }

        const assignable = sortedUsers.filter(u => 
            agentRoles.includes(u.role) && 
            u.isActive && 
            !u.managerIds?.includes(currentUser.id)
        );
        
        return { usersToDisplay: displayUsers, activeManagers: managers, assignableAgents: assignable };
    }, [users, currentUser]);

    const handleAddNew = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            onDeleteUser(userId);
        }
    }
    
    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">
                            {currentUser.role === UserRole.MANAGER ? 'My Team' : 'Account Management'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {currentUser.role === UserRole.SUPER_ADMIN ? 'Create, edit, and manage all user accounts.' : 'View and manage your team members.'}
                        </p>
                    </div>
                    {currentUser.role === UserRole.SUPER_ADMIN && (
                         <button onClick={handleAddNew} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                            Add New User
                        </button>
                    )}
                </div>
                
                {usersToDisplay.length === 0 && currentUser.role !== UserRole.MANAGER ? (
                     <div className="text-center py-8">
                        <UserIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                        <p className="text-slate-500">No user accounts to display.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Email / Work ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Manager(s)</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {usersToDisplay.map(user => {
                                    const managers = user.managerIds?.map(mId => users.find(u => u.id === mId)).filter(Boolean) as User[];
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50 even:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.firstName} {user.lastName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                                                <div>{user.email}</div>
                                                <div className="text-xs text-slate-500">{user.workId}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{user.role}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                                                {managers && managers.length > 0 ? managers.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {user.isActive ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                                    {currentUser.role === UserRole.SUPER_ADMIN && currentUser.id !== user.id && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                                        </>
                                                    )}
                                                    {currentUser.role === UserRole.MANAGER && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <button onClick={() => onTeamAssignment(user.id, currentUser.id, 'unassign')} className="text-amber-600 hover:text-amber-900">Unassign</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                         {usersToDisplay.length === 0 && currentUser.role === UserRole.MANAGER && (
                            <div className="text-center py-8">
                                <p className="text-slate-500">You have not assigned any agents to your team yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {currentUser.role === UserRole.MANAGER && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-7xl mx-auto">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Team Assignment</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-4">Assign available agents to your team. Agents may be assigned to multiple managers.</p>
                    {assignableAgents.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {assignableAgents.map(agent => (
                                <div key={agent.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                                    <div>
                                        <span className="font-medium text-slate-800">{agent.firstName} {agent.lastName}</span>
                                        <span className="text-xs text-slate-500 ml-2">({agent.role})</span>
                                    </div>
                                    <button onClick={() => onTeamAssignment(agent.id, currentUser.id, 'assign')} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors">
                                        Assign to Me
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-slate-500">There are no available agents to assign to your team at this time.</p>
                        </div>
                    )}
                </div>
            )}

            {currentUser.role === UserRole.SUPER_ADMIN && (
                <CouponTypeManager couponTypes={couponTypes} onCreate={onCreateCouponType} onDelete={onDeleteCouponType} />
            )}

            {isModalOpen && (
                <UserFormModal
                    userToEdit={editingUser}
                    currentUser={currentUser}
                    allCouponTypes={couponTypes}
                    activeManagers={activeManagers}
                    onSave={onSaveUser}
                    onClose={() => setIsModalOpen(false)}
                    existingEmails={users.map(u => u.email.toLowerCase()).filter(email => email !== editingUser?.email.toLowerCase())}
                />
            )}
        </div>
    );
};
