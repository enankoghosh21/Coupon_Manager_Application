import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GenerationRecord, Coupon, CouponStatus, User, UserRole } from '../types';
import { TicketIcon } from './icons/TicketIcon';

type GenerationDetails = Omit<GenerationRecord, 'generatedAt' | 'agentName' | 'agentId'>;

interface GeneratorProps {
  onGenerate: (details: Omit<GenerationRecord, 'generatedAt'>, type: string, promoName: string) => Coupon | 'APPROVAL_REQUESTED' | null;
  availableCoupons: Coupon[];
  usedCoupons: Coupon[];
  currentUser: User;
}

const initialFormState: GenerationDetails = {
    caseId: '',
    userId: '',
    orderNumber: '',
    reason: '',
};

interface FormErrors {
    caseId?: string;
    userId?: string;
    agentName?: string;
    orderNumber?: string;
    reason?: string;
    selection?: string;
}

export const Generator: React.FC<GeneratorProps> = ({ onGenerate, availableCoupons, usedCoupons, currentUser }) => {
  const [formState, setFormState] = useState<GenerationDetails>(initialFormState);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPromoName, setSelectedPromoName] = useState<string>('');
  const [generatedCoupon, setGeneratedCoupon] = useState<Coupon | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isDuplicateRequest, setIsDuplicateRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [noOrderNumber, setNoOrderNumber] = useState(false);

  const { availableTypes, availablePromoNames, availableCountForSelection } = useMemo(() => {
    let allTypesInInventory = [...new Set(availableCoupons.map(c => c.type))].sort();

    // Filter types based on user's access rights
    const userIsAgent = [UserRole.L1_AGENT, UserRole.L2_AGENT, UserRole.CMT, UserRole.L4].includes(currentUser.role);
    if (userIsAgent && currentUser.accessibleCouponTypes && currentUser.accessibleCouponTypes.length > 0) {
        allTypesInInventory = allTypesInInventory.filter(type => currentUser.accessibleCouponTypes?.includes(type));
    }
    
    let promoNames: string[] = [];
    if (selectedType) {
        promoNames = [...new Set<string>(availableCoupons.filter(c => c.type === selectedType).map(c => c.promoName))].sort();
    }

    let count = 0;
    if (selectedType && selectedPromoName) {
        count = availableCoupons.filter(c => c.type === selectedType && c.promoName === selectedPromoName).length;
    }

    return {
        availableTypes: allTypesInInventory,
        availablePromoNames: promoNames,
        availableCountForSelection: count
    };
  }, [availableCoupons, selectedType, selectedPromoName, currentUser]);

  useEffect(() => {
    // Only check for duplicates if both User ID and a non-empty Order Number are present
    if (formState.userId && formState.orderNumber && !noOrderNumber) {
        const isDuplicate = usedCoupons.some(c =>
            c.status === CouponStatus.USED &&
            c.generationRecord?.userId.trim().toLowerCase() === formState.userId.trim().toLowerCase() &&
            c.generationRecord?.orderNumber?.trim().toLowerCase() === formState.orderNumber.trim().toLowerCase()
        );
        setIsDuplicateRequest(isDuplicate);
    } else {
        // No duplicate if order number is missing
        setIsDuplicateRequest(false);
    }
  }, [formState.userId, formState.orderNumber, usedCoupons, noOrderNumber]);


  const validateField = useCallback((name: string, value: string): string | undefined => {
    switch(name) {
        case 'userId':
        case 'reason':
            if (!value.trim()) return 'This field is required.';
            break;
        case 'orderNumber':
             if (!noOrderNumber && !value.trim()) return 'This field is required.';
            break;
        default:
            break;
    }
    return undefined;
  }, [noOrderNumber]);

  const isFormValid = useMemo(() => {
    if (!formState.userId.trim() || !formState.reason.trim()) return false;
    if (!noOrderNumber && !formState.orderNumber?.trim()) return false;
    if (!selectedType || !selectedPromoName) return false;

    if (formErrors.userId || formErrors.reason) return false;
    if (!noOrderNumber && formErrors.orderNumber) return false;
    
    return true;
}, [formState, selectedType, selectedPromoName, formErrors, noOrderNumber]);


  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setSelectedType(newType);
    setSelectedPromoName(''); // Reset promo name when type changes
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));

    const error = validateField(name, value);
    setFormErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
            newErrors[name as keyof FormErrors] = error;
        } else {
            delete newErrors[name as keyof FormErrors];
        }
        return newErrors;
    });
  };

  const handleNoOrderNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setNoOrderNumber(isChecked);
    if (isChecked) {
        // Clear order number and its errors when checkbox is checked
        setFormState(prev => ({ ...prev, orderNumber: '' }));
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.orderNumber;
            return newErrors;
        });
    }
  };
  
  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setSelectedType('');
    setSelectedPromoName('');
    setFormErrors({});
    setNoOrderNumber(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setSubmitError("Please correct the errors before submitting.");
      return;
    }
    setSubmitError(null);
    setGeneratedCoupon(null);
    setRequestSubmitted(false);
    setCopied(false);

    try {
      const agentFullName = `${currentUser.firstName} ${currentUser.lastName}`;
      const generationDetails = { ...formState, agentName: agentFullName, agentId: currentUser.id };
      const result = onGenerate(generationDetails, selectedType, selectedPromoName);

      if (result === 'APPROVAL_REQUESTED') {
          setRequestSubmitted(true);
          resetForm();
      } else if (result) {
        setGeneratedCoupon(result);
        resetForm();
      } else {
        setSubmitError(`No available coupons for the selected type and promo. Please try another combination or contact an administrator.`);
      }
    } catch (err) {
        if (err instanceof Error) {
            setSubmitError(err.message);
        } else {
            setSubmitError('An unknown error occurred during coupon generation.');
        }
    }
  };

  const copyToClipboard = () => {
    if (generatedCoupon) {
        navigator.clipboard.writeText(generatedCoupon.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  }

  const agentFullName = `${currentUser.firstName} ${currentUser.lastName}`;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-start">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex-1 w-full">
            <div className="mb-6 pb-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Generate a Coupon</h3>
                <p className="text-sm text-slate-500 mt-1">Fill in the details below to receive a single-use coupon code.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="couponType" className="block text-sm font-medium text-slate-700 mb-1">Coupon Type</label>
                        <select id="couponType" value={selectedType} onChange={handleTypeChange} className="form-select" required >
                            <option value="" disabled>Select a type</option>
                            {availableTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="promoName" className="block text-sm font-medium text-slate-700 mb-1">Promo Name</label>
                        <select id="promoName" value={selectedPromoName} onChange={(e) => setSelectedPromoName(e.target.value)} className="form-select" required disabled={!selectedType} >
                            <option value="" disabled>Select a promo</option>
                            {availablePromoNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                 </div>
                 <div>
                    <label htmlFor="agentName" className="block text-sm font-medium text-slate-700 mb-1">Agent Name</label>
                    <input type="text" name="agentName" id="agentName" value={agentFullName} readOnly className="form-input bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="caseId" className="block text-sm font-medium text-slate-700 mb-1">Case ID</label>
                        <input type="text" name="caseId" id="caseId" value={formState.caseId} onChange={handleChange} className="form-input" />
                    </div>
                    <div>
                        <label htmlFor="userId" className="block text-sm font-medium text-slate-700 mb-1">User ID</label>
                        <input type="text" name="userId" id="userId" value={formState.userId} onChange={handleChange} className={`form-input ${formErrors.userId ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} required />
                        {formErrors.userId && <p className="mt-1 text-sm text-red-600">{formErrors.userId}</p>}
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700">Order Number</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="noOrderNumber"
                                checked={noOrderNumber}
                                onChange={handleNoOrderNumberChange}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="noOrderNumber" className="text-sm text-slate-600">No Order Number</label>
                        </div>
                    </div>
                    <input
                        type="text"
                        name="orderNumber"
                        id="orderNumber"
                        value={formState.orderNumber || ''}
                        onChange={handleChange}
                        disabled={noOrderNumber}
                        className={`form-input ${formErrors.orderNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${noOrderNumber ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        required={!noOrderNumber}
                    />
                    {formErrors.orderNumber && !noOrderNumber && <p className="mt-1 text-sm text-red-600">{formErrors.orderNumber}</p>}
                </div>
                <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">Reason for Coupon</label>
                    <textarea name="reason" id="reason" rows={3} value={formState.reason} onChange={handleChange} className={`form-textarea w-full ${formErrors.reason ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} required />
                    {formErrors.reason && <p className="mt-1 text-sm text-red-600">{formErrors.reason}</p>}
                </div>

                {isDuplicateRequest && (
                     <div className="p-3 bg-blue-50 border border-blue-300 text-blue-800 text-sm rounded-md">
                        <p><strong>Notice:</strong> A coupon already exists for this User ID and Order Number. Submitting will send a request to an administrator for approval.</p>
                    </div>
                )}

                {availableCountForSelection > 0 && availableCountForSelection <= 10 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded-md" role="alert">
                    <p>
                        <strong>Warning:</strong> Only <strong>{availableCountForSelection}</strong> coupon(s) left for this selection.
                    </p>
                    </div>
                )}

                {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                
                <div className="pt-4">
                    <button type="submit" disabled={!isFormValid || availableTypes.length === 0} className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                        isDuplicateRequest
                        ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    } disabled:bg-slate-400 disabled:cursor-not-allowed`}>
                        {availableTypes.length === 0 
                            ? 'No Coupons Available For You'
                            : isDuplicateRequest 
                                ? 'Request Approval' 
                                : 'Generate Coupon'}
                    </button>
                </div>
            </form>
        </div>

        <div className="w-full md:w-80 flex-shrink-0">
            {generatedCoupon && (
                 <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center">
                    <h3 className="text-base font-semibold text-slate-800 mb-4">Your Generated Coupon</h3>
                    <div className="relative bg-gradient-to-br from-indigo-50 to-white border-2 border-dashed border-indigo-200 rounded-lg p-4 my-2">
                        <TicketIcon className="w-10 h-10 mx-auto text-indigo-500 mb-2" />
                        <p className="text-2xl font-bold font-mono tracking-widest text-slate-900">{generatedCoupon.code}</p>
                        <p className="text-sm font-medium text-slate-600 mt-1">
                            {generatedCoupon.promoName}
                        </p>
                    </div>
                    {generatedCoupon.expiresAt && (
                        <p className="text-xs text-slate-500 mb-4">
                            Expires on: <span className="font-medium">{generatedCoupon.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' })}</span>
                        </p>
                    )}
                     <button onClick={copyToClipboard} className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                </div>
            )}
            {requestSubmitted && (
                 <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center">
                    <h3 className="text-base font-semibold text-slate-800 mb-2">Request Submitted</h3>
                    <p className="text-sm text-slate-600">Your request has been sent for approval. You will be notified once it has been reviewed by an administrator.</p>
                </div>
            )}
        </div>
    </div>
  );
};