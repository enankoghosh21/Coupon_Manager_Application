import { Coupon, CouponStatus, GenerationRecord } from '../types';

const MOCK_TYPES = [
    "Customer Happiness", "Loyalty Reward", "New User Bonus", 
    "Marketing Campaign", "GrayScale - Mobile", "GrayScale - IoT",
    "Seasonal Promo", "VIP Exclusive"
];

const MOCK_PROMO_TEMPLATES = [
    { name: "₹{v} OFF OnePlus Coupon", value: [300, 500, 1000] },
    { name: "Flat ₹{v} Discount", value: [150, 250, 400] },
    { name: "{v}% OFF on Accessories", value: [10, 15, 20] },
    { name: "Special Discount Voucher ₹{v}", value: [750, 1250] }
];

const MOCK_AGENT_NAMES = ["Amit Sharma", "Priya Singh", "Rahul Kumar", "Sunita Devi", "Vikram Rathod"];

/**
 * Generates a random alphanumeric string of a given length.
 */
const randomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Returns a random element from an array.
 */
const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generates a random date within a given range of days from now.
 */
const randomDate = (startDays: number, endDays: number): Date => {
    const today = new Date();
    const randomDays = startDays + Math.random() * (endDays - startDays);
    return new Date(today.getTime() + randomDays * 24 * 60 * 60 * 1000);
};

/**
 * Generates a specified number of mock coupons.
 */
export const generateMockCoupons = (count: number): Coupon[] => {
    const coupons: Coupon[] = [];
    const usedCodes = new Set<string>();

    for (let i = 0; i < count; i++) {
        let code: string;
        do {
            code = randomString(12);
        } while (usedCodes.has(code));
        usedCodes.add(code);
        
        const promoTemplate = getRandomElement(MOCK_PROMO_TEMPLATES);
        const value = getRandomElement(promoTemplate.value);
        const promoName = promoTemplate.name.replace('{v}', String(value));
        
        const status = Math.random() < 0.25 ? CouponStatus.USED : CouponStatus.AVAILABLE;

        let beginsAt: Date;
        let expiresAt: Date;
        
        const dateType = Math.random();
        if (dateType < 0.6) { // 60% Active now
            beginsAt = randomDate(-60, -1);
            expiresAt = randomDate(30, 120);
        } else if (dateType < 0.8) { // 20% Scheduled
            beginsAt = randomDate(5, 30);
            expiresAt = randomDate(31, 150);
        } else { // 20% Expired
            beginsAt = randomDate(-120, -60);
            expiresAt = randomDate(-30, -1);
        }

        let generationRecord: GenerationRecord | undefined = undefined;

        if (status === CouponStatus.USED) {
            generationRecord = {
                caseId: `C-IN${String(Math.floor(1000000000 + Math.random() * 9000000000))}`,
                userId: `user_${randomString(8)}`,
                agentName: getRandomElement(MOCK_AGENT_NAMES),
                orderNumber: Math.random() > 0.5 ? `ORD${randomString(8)}` : undefined,
                reason: "Customer complaint resolution",
                generatedAt: randomDate(-50, -1),
            };
        }

        coupons.push({
            id: Date.now() + i,
            promoId: `SP${randomString(15)}`,
            promoName: promoName,
            code: code,
            status: status,
            type: getRandomElement(MOCK_TYPES),
            value: value,
            generationRecord: generationRecord,
            beginsAt: beginsAt,
            expiresAt: expiresAt,
        });
    }

    return coupons.sort((a,b) => a.code.localeCompare(b.code));
};
