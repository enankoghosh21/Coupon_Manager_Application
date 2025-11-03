import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Coupon, CouponStatus } from '../types';
import { DashboardIcon } from './icons/DashboardIcon';
import { TicketIcon } from './icons/TicketIcon';

// Add type declaration for Chart.js from CDN
declare global {
    interface Window {
        Chart: any;
    }
}

interface DashboardProps {
  coupons: Coupon[];
}

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; iconBgColor: string; }> = ({ title, value, icon, iconBgColor }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex items-center space-x-4">
        <div className={`p-3 rounded-full ${iconBgColor}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    </div>
);


export const Dashboard: React.FC<DashboardProps> = ({ coupons }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const typePieChartRef = useRef<HTMLCanvasElement>(null);
    const promoBarChartRef = useRef<HTMLCanvasElement>(null);
    const typeChartInstanceRef = useRef<any>(null);
    const promoChartInstanceRef = useRef<any>(null);

    const { stats, agentPerformance } = useMemo(() => {
        const now = new Date();
        
        // Inventory stats are always based on the full dataset and current time
        const total = coupons.length;
        const available = coupons.filter(c => 
            c.status === CouponStatus.AVAILABLE &&
            c.beginsAt <= now &&
            (!c.expiresAt || c.expiresAt >= now)
        ).length;
        const expired = coupons.filter(c => 
            c.status === CouponStatus.AVAILABLE && 
            c.expiresAt && c.expiresAt < now
        ).length;
        const scheduled = coupons.filter(c => 
            c.status === CouponStatus.AVAILABLE && 
            c.beginsAt > now
        ).length;

        // Usage stats are filtered by the selected date range
        let usedCoupons = coupons.filter(c => c.status === CouponStatus.USED);

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            usedCoupons = usedCoupons.filter(c => c.generationRecord!.generatedAt >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            usedCoupons = usedCoupons.filter(c => c.generationRecord!.generatedAt <= end);
        }

        const usedCount = usedCoupons.length;
        const totalValueUsed = usedCoupons.reduce((sum, coupon) => sum + (coupon.value || 0), 0);
        
        // FIX: Added an explicit type annotation to `performance` to ensure correct type inference for `data` in the subsequent `.map` call, resolving the spread operator error.
        const performance: Record<string, { totalCoupons: number; totalValue: number; types: Record<string, number> }> = usedCoupons.reduce((acc, coupon) => {
            const agentName = coupon.generationRecord!.agentName;
            if (!acc[agentName]) {
                acc[agentName] = { totalCoupons: 0, totalValue: 0, types: {} };
            }
            acc[agentName].totalCoupons += 1;
            acc[agentName].totalValue += coupon.value || 0;
            acc[agentName].types[coupon.type] = (acc[agentName].types[coupon.type] || 0) + 1;
            return acc;
        }, {} as Record<string, { totalCoupons: number; totalValue: number; types: Record<string, number> }>);

        const agentPerformanceData = Object.entries(performance)
            .map(([agentName, data]) => ({ agentName, ...data }))
            .sort((a, b) => b.totalCoupons - a.totalCoupons);

        // Inventory breakdown stats are based on all coupons
        // FIX: Explicitly typing the accumulator in `reduce` is a more robust way to handle type inference for the initial empty object.
        const byType: Record<string, number> = coupons.reduce((acc: Record<string, number>, coupon) => {
            acc[coupon.type] = (acc[coupon.type] || 0) + 1;
            return acc;
        }, {});

        const byPromoName: Record<string, number> = coupons.reduce((acc: Record<string, number>, coupon) => {
            acc[coupon.promoName] = (acc[coupon.promoName] || 0) + 1;
            return acc;
        }, {});

        return {
            stats: {
                total,
                used: usedCount,
                available,
                expired,
                scheduled,
                totalValueUsed,
                byType,
                byPromoName,
            },
            agentPerformance: agentPerformanceData
        };
    }, [coupons, startDate, endDate]);
    
    // Helper to generate a vibrant color palette for charts
    const generateColors = (numColors: number) => {
        const colors = [];
        for (let i = 0; i < numColors; i++) {
            const hue = (210 + (i * 25)) % 360; // Start with a blueish tone
            colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
        }
        return colors;
    };

    // Effect hook to create and update the 'Coupons by Type' pie chart
    useEffect(() => {
        if (typePieChartRef.current && Object.keys(stats.byType).length > 0) {
            const ctx = typePieChartRef.current.getContext('2d');
            if (ctx) {
                if (typeChartInstanceRef.current) {
                    typeChartInstanceRef.current.destroy();
                }

                const labels = Object.keys(stats.byType);
                const data = Object.values(stats.byType);

                typeChartInstanceRef.current = new window.Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: generateColors(labels.length),
                            borderColor: 'rgba(255, 255, 255, 0.7)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { position: 'top' } }
                    }
                });
            }
        }
        return () => { // Cleanup function to destroy chart on component unmount
            if (typeChartInstanceRef.current) {
                typeChartInstanceRef.current.destroy();
                typeChartInstanceRef.current = null;
            }
        };
    }, [stats.byType]);

    // Effect hook to create and update the 'Coupons by Promo Name' bar chart
    useEffect(() => {
        if (promoBarChartRef.current && Object.keys(stats.byPromoName).length > 0) {
            const ctx = promoBarChartRef.current.getContext('2d');
            if (ctx) {
                if (promoChartInstanceRef.current) {
                    promoChartInstanceRef.current.destroy();
                }

                // FIX: Cast values to number to resolve arithmetic operation errors caused by incorrect type inference.
                const sortedPromos = Object.entries(stats.byPromoName).sort(([, a], [, b]) => (b as number) - (a as number));
                const topPromos = sortedPromos.slice(0, 15);
                const otherPromosCount = sortedPromos.slice(15).reduce((acc, [, count]) => acc + (count as number), 0);
                
                const fullLabels = topPromos.map(([name]) => name);
                const truncatedLabels = fullLabels.map(name => name.length > 30 ? name.substring(0, 27) + '...' : name);
                const data = topPromos.map(([, count]) => count);

                if (otherPromosCount > 0) {
                    fullLabels.push(`${sortedPromos.length - 15} Other Promos`);
                    truncatedLabels.push('Others');
                    data.push(otherPromosCount);
                }

                promoChartInstanceRef.current = new window.Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: truncatedLabels,
                        datasets: [{
                            label: 'Count',
                            data: data,
                            backgroundColor: generateColors(truncatedLabels.length),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    title: (tooltipItems) => fullLabels[tooltipItems[0].dataIndex]
                                }
                            }
                        },
                        scales: { x: { beginAtZero: true } }
                    }
                });
            }
        }
        return () => { // Cleanup function
            if (promoChartInstanceRef.current) {
                promoChartInstanceRef.current.destroy();
                promoChartInstanceRef.current = null;
            }
        };
    }, [stats.byPromoName]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    }

    const handleResetDates = () => {
        setStartDate('');
        setEndDate('');
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-slate-800">Dashboard Overview</h2>
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <label htmlFor="start-date" className="text-sm font-medium text-slate-600">From:</label>
                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input !p-1" />
                    <label htmlFor="end-date" className="text-sm font-medium text-slate-600">To:</label>
                    <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input !p-1" />
                    <button onClick={handleResetDates} className="px-3 py-1 text-sm font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300">Reset</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatCard title="Total Coupons" value={stats.total} icon={<DashboardIcon className="w-6 h-6 text-indigo-600" />} iconBgColor="bg-indigo-100" />
                <StatCard title="Available Now" value={stats.available} icon={<TicketIcon className="w-6 h-6 text-green-600" />} iconBgColor="bg-green-100" />
                <StatCard title="Used" value={stats.used} icon={<TicketIcon className="w-6 h-6 text-red-600" />} iconBgColor="bg-red-100" />
                <StatCard title="Total Value Used" value={formatCurrency(stats.totalValueUsed)} icon={<span className="text-xl font-bold text-emerald-600">₹</span>} iconBgColor="bg-emerald-100" />
                <StatCard title="Scheduled" value={stats.scheduled} icon={<TicketIcon className="w-6 h-6 text-blue-600" />} iconBgColor="bg-blue-100" />
                <StatCard title="Expired" value={stats.expired} icon={<TicketIcon className="w-6 h-6 text-yellow-600" />} iconBgColor="bg-yellow-100" />
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Agent Performance</h3>
                <div className="overflow-x-auto max-h-96">
                    {agentPerformance.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Agent Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Total Issued</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Total Value</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Type Breakdown</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {agentPerformance.map(agent => (
                                    <tr key={agent.agentName} className="even:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{agent.agentName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-semibold">{agent.totalCoupons}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{formatCurrency(agent.totalValue)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                                            {Object.entries(agent.types).map(([type, count]) => `${type}: ${count}`).join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-4">No agent activity in the selected period.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Coupons by Type (Total Inventory)</h3>
                    {Object.keys(stats.byType).length > 0 ? (
                        <canvas ref={typePieChartRef} id="typePieChart"></canvas>
                    ) : (
                         <p className="text-sm text-slate-500 text-center py-4">No coupons to visualize.</p>
                    )}
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Coupons by Promo Name (Total Inventory)</h3>
                    {Object.keys(stats.byPromoName).length > 0 ? (
                        <div className="relative h-96">
                            <canvas ref={promoBarChartRef} id="promoBarChart"></canvas>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-4">No coupons to visualize.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
