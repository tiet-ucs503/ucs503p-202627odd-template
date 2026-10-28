// VeriHire Verification Intelligence Data Store

export const KPI_METRICS = [
  {
    id: 'total',
    title: 'TOTAL VERIFICATIONS',
    value: 42,
    subtext: '+8 this month',
    accentColor: '#F5F5F5',
  },
  {
    id: 'high-risk',
    title: 'HIGH-RISK POSTINGS',
    value: 11,
    subtext: '26.2% of checks',
    accentColor: '#EF4444',
  },
  {
    id: 'medium-risk',
    title: 'MEDIUM-RISK POSTINGS',
    value: 24,
    subtext: '57.1% of checks',
    accentColor: '#F59E0B',
  },
  {
    id: 'low-risk',
    title: 'LOW-RISK POSTINGS',
    value: 7,
    subtext: '16.7% of checks',
    accentColor: '#06C167',
  },
];

export const RECENT_VERIFICATIONS = [
  {
    id: 'ver-101',
    posting: 'Software Engineer Intern',
    company: 'ABC Technologies',
    risk: 'HIGH',
    confidence: '91%',
    date: 'Today',
    details: 'Unregistered entity, fee request flagged in initial message.',
  },
  {
    id: 'ver-102',
    posting: 'Data Analyst Intern',
    company: 'XYZ Labs',
    risk: 'LOW',
    confidence: '94%',
    date: 'Yesterday',
    details: 'Verified corporate domain, legitimate HR contact.',
  },
  {
    id: 'ver-103',
    posting: 'Web Developer',
    company: 'Unknown Company',
    risk: 'MEDIUM',
    confidence: '76%',
    date: 'Sep 14',
    details: 'Incomplete company info, generic Telegram contact link.',
  },
  {
    id: 'ver-104',
    posting: 'Machine Learning Intern',
    company: 'TechNova',
    risk: 'HIGH',
    confidence: '88%',
    date: 'Sep 13',
    details: 'Suspicious domain registration date (3 days old), high security deposit requested.',
  },
];

export const RISK_DISTRIBUTION = [
  { label: 'LOW', percentage: 17, count: 7, color: '#06C167' },
  { label: 'MEDIUM', percentage: 57, count: 24, color: '#F59E0B' },
  { label: 'HIGH', percentage: 26, count: 11, color: '#EF4444' },
];

export const VERIFICATION_ACTIVITY = {
  '7 DAYS': [
    { label: 'Day 1', checks: 2 },
    { label: 'Day 2', checks: 5 },
    { label: 'Day 3', checks: 3 },
    { label: 'Day 4', checks: 8 },
    { label: 'Day 5', checks: 6 },
    { label: 'Day 6', checks: 4 },
    { label: 'Day 7', checks: 7 },
  ],
  '30 DAYS': [
    { label: 'Week 1', checks: 8 },
    { label: 'Week 2', checks: 12 },
    { label: 'Week 3', checks: 14 },
    { label: 'Week 4', checks: 8 },
  ],
  '90 DAYS': [
    { label: 'Month 1', checks: 28 },
    { label: 'Month 2', checks: 35 },
    { label: 'Month 3', checks: 42 },
  ],
  'ALL TIME': [
    { label: 'Q1', checks: 45 },
    { label: 'Q2', checks: 78 },
    { label: 'Q3', checks: 110 },
  ],
};

export const ACTION_REQUIRED_ITEMS = [
  {
    id: 'act-1',
    risk: 'HIGH',
    posting: 'Machine Learning Internship — TechNova',
    signalCount: 4,
    description: '4 suspicious signals detected',
  },
  {
    id: 'act-2',
    risk: 'MEDIUM',
    posting: 'Web Developer — Unknown Company',
    signalCount: 2,
    description: 'Incomplete company information detected',
  },
];

export const FREQUENTLY_DETECTED_SIGNALS = [
  { name: 'Registration / application fee', percentage: 34 },
  { name: 'Unverified company information', percentage: 27 },
  { name: 'Generic contact address', percentage: 19 },
  { name: 'Unrealistic compensation', percentage: 13 },
  { name: 'Urgency / pressure language', percentage: 7 },
];

export const SYSTEM_STATUS = {
  signalEngine: 'OPERATIONAL',
  riskModel: 'READY',
  analysisEngine: 'ONLINE',
  lastAnalysis: '00:42 AGO',
};
