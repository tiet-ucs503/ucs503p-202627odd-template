
export type LaundryStatus =
    | 'WAITING_FOR_VERIFICATION'
    | 'VERIFIED'
    | 'AWAITING_TAGGING'
    | 'TAGGED'
    | 'IN_LAUNDRY'
    | 'RETURNED'
    | 'READY_FOR_PICKUP'
    | 'COLLECTED';

export interface LaundryItemCount {
    category: string;
    quantity: number;
}

export interface LaundryBatch {
    id: string;           // e.g. "L-1042"
    status: LaundryStatus;
    submittedAt: string;   // ISO date
    expectedDate: string;
    items: LaundryItemCount[];
    remarks?: string;
}

export interface ComplaintItem {
    id: string;
    batchId: string;
    type: 'MISSING' | 'DAMAGED' | 'WRONG_ITEM' | 'DELAY' | 'OTHER';
    status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
    description: string;
    createdAt: string;
}

export interface NotificationItem {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    read: boolean;
}

export const mockStudent = {
    id: '24COE123',
    name: 'Devansh Dhawan',
    email: '24coe123@thapar.edu',
    hostel: 'Hostel A',
    semester: '2026-27',
};

export const mockBatches: LaundryBatch[] = [
    {
        id: 'L-1042',
        status: 'IN_LAUNDRY',
        submittedAt: '2026-09-08',
        expectedDate: '2026-09-12',
        items: [
            { category: 'Shirt', quantity: 2 },
            { category: 'T-shirt', quantity: 4 },
            { category: 'Pants', quantity: 2 },
        ],
    },
    {
        id: 'L-1038',
        status: 'COLLECTED',
        submittedAt: '2026-09-01',
        expectedDate: '2026-09-05',
        items: [
            { category: 'Bedsheet', quantity: 1 },
            { category: 'Towel', quantity: 2 },
        ],
    },
];

export const mockComplaints: ComplaintItem[] = [
    {
        id: 'C-201',
        batchId: 'L-1038',
        type: 'MISSING',
        status: 'INVESTIGATING',
        description: 'One towel missing from the returned batch.',
        createdAt: '2026-09-06',
    },
];

export const mockNotifications: NotificationItem[] = [
    { id: 'N-1', title: 'Laundry ready for pickup', body: 'Batch L-1038 is ready for pickup.', createdAt: '2026-09-05', read: true },
    { id: 'N-2', title: 'Laundry processing started', body: 'Batch L-1042 has entered the wash cycle.', createdAt: '2026-09-09', read: false },
];