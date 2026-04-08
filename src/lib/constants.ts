// ARIP form option lists — shared across CreateCaseDialog and CaseDetailPage
export const departments = [
  'Marketing',
  'Finance',
  'Management',
  'Accounting',
  'Economics',
  'International Business',
  'Information Technology',
  'Hospitality & Tourism',
];

export const campuses = ['Beirut', 'Byblos', 'Online'];

export const academicFactors = [
  'Study skills',
  'Time management',
  'Quantitative difficulty',
  'Writing difficulty',
  'Missing prerequisites',
  'Test anxiety',
];

export const externalFactors = [
  'Work obligations',
  'Family responsibilities',
  'Financial stress',
  'Health concerns',
  'Mental health concerns',
];

export const engagementFactors = [
  'Poor attendance',
  'Low participation',
  'Missed deadlines',
  'Lack of motivation',
  'Major mismatch',
];

export const courseStrategies = [
  'Maintain current schedule',
  'Reduce course load',
  'Withdraw from course(s)',
  'Retake course(s) next term',
  'Recommended course sequencing adjustments',
];

export const supportActivities = [
  'Tutoring',
  'Writing Center sessions',
  'Counseling referral (Student Affairs)',
  'Learning support / accommodation referral (if applicable)',
];

export const monitoringReqs = [
  'Bi-weekly advisor check-in',
  'Midterm grade review required',
];

// Workflow states
export const WORKFLOW_STATES = [
  'Student identified',
  'Advisor assigned',
  'Meeting pending',
  'Meeting completed',
  'AIP in progress',
  'Follow-up required',
  'Outcome recorded',
  'Case closed',
] as const;

// Normalize status values
export const normalizeStatus = (val: string | null | undefined): string => {
  if (!val) return 'not_started';
  const v = val.trim().toLowerCase();
  if (['done', 'completed', 'yes'].includes(v)) return 'completed';
  if (['pending', 'not yet', 'in_progress', 'in progress'].includes(v)) return 'pending';
  return v;
};

// Get workflow state for a case
export const getWorkflowState = (c: {
  assigned_advisor: string | null;
  meeting_status: string;
  aip_status: string;
  outcome_status: string;
}): string => {
  if (c.outcome_status === 'completed') return 'Case closed';
  if (c.aip_status === 'completed') return 'Follow-up required';
  if (c.meeting_status === 'completed') return 'AIP in progress';
  if (c.assigned_advisor) return 'Meeting pending';
  return 'Student identified';
};

// Intervention outcome display
export const getInterventionOutcomeLabel = (c: {
  meeting_status: string;
  outcome_status: string;
  final_outcome?: string;
}): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  if (c.meeting_status !== 'completed') {
    return { label: 'No meeting recorded', variant: 'outline' };
  }
  if (c.outcome_status !== 'completed' || !c.final_outcome) {
    return { label: 'Outcome pending', variant: 'secondary' };
  }
  const map: Record<string, string> = {
    'improved_above_threshold': 'Improved above threshold',
    'improved_still_at_risk': 'Improved, still at risk',
    'declined_escalated': 'Declined / Escalated',
    'withdrew': 'Student withdrew',
    'other': 'Other outcome',
  };
  return { label: map[c.final_outcome] || c.final_outcome, variant: 'default' };
};

// Chart color palette derived from Pantone 336 — use CSS variables where possible
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];
