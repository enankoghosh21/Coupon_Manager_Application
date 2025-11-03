import React, { useState, useCallback } from 'react';
import { Coupon, CouponStatus, SkippedCoupon } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { ErrorIcon } from './icons/ErrorIcon';

// Add type declarations for window objects from CDNs
declare global {
    interface Window {
        XLSX: any;
    }
}


interface UploaderProps {
  onUpload: (result: { newCoupons: Coupon[], skippedCoupons: SkippedCoupon[] }) => void;
  isLoading: boolean;
  existingCoupons: Coupon[];
}

const parsePromoValue = (promoName: string): number => {
    const match = promoName.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

/**
 * Converts an Excel serial date number to a JavaScript Date object.
 * @param serial Excel serial number.
 * @returns JavaScript Date object.
 */
const excelSerialDateToJSDate = (serial: number): Date => {
  // Excel's epoch starts on 1900-01-01. JavaScript's epoch is 1970-01-01.
  // The difference is 25569 days. We subtract this to align with the Unix epoch.
  // Excel has a bug where it thinks 1900 was a leap year, so for dates after Feb 1900, we'd typically subtract 1 more day.
  // However, the standard conversion formula (serial - 25569) * 86400000 works for most cases.
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const jsDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return jsDate;
}

const parseUtcDate = (dateValue: string | number): Date | null => {
    if (typeof dateValue === 'number' && dateValue > 0) {
      try {
        return excelSerialDateToJSDate(dateValue);
      } catch (e) {
        return null;
      }
    }
    
    if (typeof dateValue === 'string' && dateValue.trim() !== '') {
        // Handles formats like '9/23/2025 5:38'
        const date = new Date(dateValue.trim() + ' UTC');
        return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
};


// This function processes the data from either a CSV or an XLSX file
const processCouponData = (data: (string | number)[][], existingCoupons: Coupon[]): { newCoupons: Coupon[], skippedCoupons: SkippedCoupon[], error: string | null } => {
    if (data.length < 2) {
        return { newCoupons: [], skippedCoupons: [], error: 'File must contain a header row and at least one data row.' };
    }

    const header = (data[0] as any[]).map(h => String(h).trim().toLowerCase());
    const requiredHeaders = ["promo id", "coupon type", "promo name", "coupon code", "coupon begin time(utc)", "coupon end time(utc)", "status"];
    
    const colIndices: Record<string, number> = {};
    requiredHeaders.forEach(rh => {
        const index = header.indexOf(rh);
        if (index !== -1) {
            colIndices[rh] = index;
        }
    });
    
    const missingHeaders = requiredHeaders.filter(rh => colIndices[rh] === undefined);
    if (missingHeaders.length > 0) {
        return { newCoupons: [], skippedCoupons: [], error: `Header is invalid. Missing required columns: ${missingHeaders.join(', ')}.` };
    }
    
    const existingCodes = new Set(existingCoupons.map(c => c.code));
    const codesInCurrentFile = new Set<string>();
    const newCoupons: Coupon[] = [];
    const skippedCoupons: SkippedCoupon[] = [];
    const dataRows = data.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
        const rowNumber = i + 2;
        const row = dataRows[i];

        const promoId = String(row[colIndices["promo id"]] || '').trim();
        const type = String(row[colIndices["coupon type"]] || '').trim();
        const promoName = String(row[colIndices["promo name"]] || '').trim();
        const code = String(row[colIndices["coupon code"]] || '').trim();
        const beginTimeValue = row[colIndices["coupon begin time(utc)"]];
        const endTimeValue = row[colIndices["coupon end time(utc)"]];
        const status = String(row[colIndices["status"]] || '').trim();

        const rowDataForReport = {
            "Promo Id": promoId,
            "Coupon Type": type,
            "Promo name": promoName,
            "Coupon code": code,
            "Status": status,
        };

        const requiredValues = {
            "promo id": promoId,
            "coupon type": type,
            "promo name": promoName,
            "coupon code": code,
            "coupon begin time(utc)": beginTimeValue,
            "coupon end time(utc)": endTimeValue,
            "status": status,
        };
        const missingColumns = Object.keys(requiredValues).filter(key => {
            const value = requiredValues[key as keyof typeof requiredValues];
            if (typeof value === 'string') {
                return !value.trim();
            }
            // FIX: Corrected a type error where a number was compared to an empty string.
            // A non-string value (like a number for an Excel date) can't be `''`,
            // so it is only considered missing if it is undefined or null.
            return value === undefined || value === null;
        });

        if (missingColumns.length > 0) {
            if (row.every(cell => String(cell || '').trim() === '')) continue;
            return { newCoupons: [], skippedCoupons: [], error: `Error on line ${rowNumber}: Row is missing data in the following required columns: ${missingColumns.map(c => `"${c}"`).join(', ')}.` };
        }

        if (status.toLowerCase() !== 'new') {
            continue;
        }
        
        if (existingCodes.has(code)) {
            skippedCoupons.push({ rowData: rowDataForReport, rowNumber, reason: 'Duplicate code (already in system)' });
            continue;
        }

        if (codesInCurrentFile.has(code)) {
            skippedCoupons.push({ rowData: rowDataForReport, rowNumber, reason: 'Duplicate code (within this file)' });
            continue;
        }
        
        codesInCurrentFile.add(code);
        
        const beginsAt = parseUtcDate(beginTimeValue as string | number);
        if (!beginsAt) {
            return { newCoupons: [], skippedCoupons: [], error: `Error on line ${rowNumber}: Invalid format for "Coupon Begin time(UTC)". Please use a standard format (e.g., 'MM/DD/YYYY HH:MM').` };
        }
        
        const expiresAt = parseUtcDate(endTimeValue as string | number);
        if (!expiresAt) {
            return { newCoupons: [], skippedCoupons: [], error: `Error on line ${rowNumber}: Invalid format for "Coupon End time(UTC)". Please use a standard format (e.g., 'MM/DD/YYYY HH:MM').` };
        }

        if (beginsAt >= expiresAt) {
            return { newCoupons: [], skippedCoupons: [], error: `Error on line ${rowNumber}: Validation failed. The "Coupon Begin time(UTC)" must be before the "Coupon End time(UTC)".` };
        }


        const value = parsePromoValue(promoName);

        newCoupons.push({
            id: Date.now() + i,
            promoId,
            type,
            promoName,
            code,
            status: CouponStatus.AVAILABLE,
            value,
            beginsAt,
            expiresAt,
        });
    }

    return { newCoupons, skippedCoupons, error: null };
};


export const Uploader: React.FC<UploaderProps> = ({ onUpload, isLoading, existingCoupons }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const headers = [
        "Promo Id", "Coupon Type", "Promo name", "Coupon code",
        "Coupon Begin time(UTC)", "Coupon End time(UTC)", "Status"
    ];
    const exampleRows = [
        ["SP6250923053848", "GrayScale - Mobile", "₹300 OFF OnePlus Coupon", "TJBHBIQUIKCEN", "9/23/2025 5:38", "12/31/2025 18:29", "New"],
        ["SP6250923053848", "GrayScale - IoT", "₹300 OFF OnePlus Coupon", "DMMFPGSRWQYPSY", "9/23/2025 5:38", "12/31/2025 18:29", "New"],
        ["SP6250923053848", "Customer Happines", "₹300 OFF OnePlus Coupon", "VZWPJRBZHYRDZL", "9/23/2025 5:38", "12/31/2025 18:29", "New"],
        ["SP6250923053848", "GrayScale - IoT", "₹300 OFF OnePlus Coupon", "OPXAMVDJLZEMVZ", "9/23/2025 5:38", "12/31/2025 18:29", "New"],
        ["SP6250923053848", "GrayScale - Mobile", "₹300 OFF OnePlus Coupon", "RCGRBIRNJENMEP", "9/23/2025 5:38", "12/31/2025 18:29", "New"]
    ];
    
    try {
        const wb = window.XLSX.utils.book_new();
        const data = [headers, ...exampleRows];
        const ws = window.XLSX.utils.aoa_to_sheet(data);

        const colWidths = headers.map((_, i) => ({
            wch: data.reduce((w, r) => Math.max(w, r[i] ? String(r[i]).length : 10), 10)
        }));
        ws['!cols'] = colWidths;

        window.XLSX.utils.book_append_sheet(wb, ws, "Coupons");
        window.XLSX.writeFile(wb, "coupon_template.xlsx");
    } catch (err) {
        console.error("Failed to generate XLSX template, falling back to CSV.", err);
        const csvContent = [headers.join(','), ...exampleRows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'coupon_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    
    const handleProcessingResult = (result: { newCoupons: Coupon[], skippedCoupons: SkippedCoupon[], error: string | null }) => {
        if (result.error) {
            setError(result.error);
        } else {
            onUpload({ newCoupons: result.newCoupons, skippedCoupons: result.skippedCoupons });
        }
        setFileName(null);
    };

    if (file.name.endsWith('.csv')) {
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = text.split(/\r?\n/).filter(line => line.trim() !== '').map(line => line.split(','));
            handleProcessingResult(processCouponData(rows, existingCoupons));
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows: (string|number)[][] = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false, dateNF: 'm/d/yyyy h:mm' });
                handleProcessingResult(processCouponData(rows, existingCoupons));
            } catch (err) {
                setError('Failed to parse Excel file. Please check the file format and content.');
                setFileName(null);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        setError("Invalid file type. Please upload a .csv or .xlsx file.");
        setFileName(null);
    }

    reader.onerror = () => {
        setError('Error reading file.');
        setFileName(null);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, [handleFileChange]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-200">
        <div>
            <h3 className="text-lg font-semibold text-slate-800">Upload New Coupons</h3>
            <p className="text-sm text-slate-500 mt-1">Download the template, add coupon data, and upload the completed file.</p>
        </div>
        <button
            onClick={handleDownloadTemplate}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
            Download Template
        </button>
      </div>

      <label
        htmlFor="file-upload"
        className="flex justify-center w-full h-36 px-4 transition bg-slate-50 border-2 border-slate-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-indigo-400 focus:outline-none"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <span className="flex items-center space-x-2">
          <UploadIcon className="w-6 h-6 text-slate-500" />
          <span className="font-medium text-slate-600">
            {fileName ? `File: ${fileName}` : 'Drop file here, or'}
            <span className="text-indigo-600 underline ml-1">browse</span>
          </span>
        </span>
        <input
          id="file-upload"
          type="file"
          accept=".csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }} // Allow re-uploading the same file name
          disabled={isLoading}
        />
      </label>
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg shadow-sm" role="alert">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <ErrorIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-semibold text-red-800">
                        Upload Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};