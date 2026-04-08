import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkflowState, getInterventionOutcomeLabel } from '@/lib/constants';
import { Search, Download, Eye, UserPlus, Plus, Upload, Trash2, XCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreateCaseDialog from '@/components/CreateCaseDialog';
import BulkImportDialog from '@/components/BulkImportDialog';
import DeleteCaseDialog from '@/components/DeleteCaseDialog';
import AssignAdvisorDialog from '@/components/AssignAdvisorDialog';
import BulkAssignDialog from '@/components/BulkAssignDialog';
import CasesTour from '@/components/CasesTour';

interface RiskCase {
  case_id: string;
  student_id: string;
  student_name: string;
  department: string;
  risk_category: string;
  assigned_advisor: string | null;
  assigned_advisor_name: string | null;
  meeting_status: string;
  aip_status: string;
  midterm_review_status: string;
  outcome_status: string;
  created_date: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default',
    pending: 'secondary',
    overdue: 'destructive',
    'not_started': 'outline',
  };
  return <Badge variant={map[status] || 'outline'} className="text-xs capitalize">{status.replace('_', ' ')}</Badge>;
};

const CasesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<RiskCase[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMeeting, setFilterMeeting] = useState('all');
  const [filterAip, setFilterAip] = useState('all');
  const [filterFollowUp, setFilterFollowUp] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Selection for bulk assign
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ caseId: string; studentName: string } | null>(null);

  // Assign advisor dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    caseId: string;
    advisorId: string | null;
    advisorName: string | null;
  } | null>(null);

  // Follow-up case IDs
  const [followUpCaseIds, setFollowUpCaseIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadCases(); }, []);

  const loadCases = useCallback(async () => {
    let query = supabase.from('risk_cases').select('*');
    if (user?.role === 'department_chair' && user.department) {
      query = query.eq('department', user.department);
    }
    if (user?.role === 'advisor') {
      query = query.eq('assigned_advisor', user.id);
    }
    const [{ data }, { data: outcomeData }, { data: followUps }] = await Promise.all([
      query.order('created_date', { ascending: false }),
      supabase.from('outcomes').select('case_id, final_outcome'),
      supabase.from('follow_ups').select('case_id'),
    ]);
    setCases(data || []);

    const oMap: Record<string, string> = {};
    outcomeData?.forEach(o => { oMap[o.case_id] = o.final_outcome; });
    setOutcomes(oMap);

    setFollowUpCaseIds(new Set(followUps?.map(f => f.case_id) || []));
    setSelectedCases(new Set());
  }, [user]);

  const hasFilters = filterDept !== 'all' || filterCategory !== 'all' || filterMeeting !== 'all' || filterAip !== 'all' || filterFollowUp !== 'all' || filterOutcome !== 'all' || search !== '';

  const clearFilters = () => {
    setSearch(''); setFilterDept('all'); setFilterCategory('all');
    setFilterMeeting('all'); setFilterAip('all'); setFilterFollowUp('all');
    setFilterOutcome('all');
  };

  const filtered = cases.filter((c) => {
    const matchSearch =
      c.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.student_id?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === 'all' || c.department === filterDept;
    const matchCat = filterCategory === 'all' || c.risk_category === filterCategory;
    const matchMeeting = filterMeeting === 'all' || c.meeting_status === filterMeeting;
    const matchAip = filterAip === 'all' || c.aip_status === filterAip;
    const matchFollowUp = filterFollowUp === 'all' ||
      (filterFollowUp === 'completed' && followUpCaseIds.has(c.case_id)) ||
      (filterFollowUp === 'not_started' && !followUpCaseIds.has(c.case_id));
    const matchOutcome = filterOutcome === 'all' || c.outcome_status === filterOutcome;
    return matchSearch && matchDept && matchCat && matchMeeting && matchAip && matchFollowUp && matchOutcome;
  });

  const departments = [...new Set(cases.map((c) => c.department))].sort();

  const exportCSV = () => {
    const headers = ['Student ID', 'Name', 'Department', 'Risk Category', 'Advisor', 'Meeting', 'AIP', 'Midterm', 'Outcome'];
    const rows = filtered.map((c) => [
      c.student_id, c.student_name, c.department, c.risk_category,
      c.assigned_advisor_name || 'Not Assigned', c.meeting_status, c.aip_status,
      c.midterm_review_status, c.outcome_status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arip_cases.csv';
    a.click();
  };

  const canManageAssignments = user?.role === 'admin' || user?.role === 'department_chair';
  const isAdvisor = user?.role === 'advisor';

  const toggleSelection = (caseId: string) => {
    setSelectedCases(prev => {
      const n = new Set(prev);
      if (n.has(caseId)) n.delete(caseId); else n.add(caseId);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedCases.size === filtered.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(filtered.map(c => c.case_id)));
    }
  };

  // Status filter dropdown helper
  const StatusFilter = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}</SelectItem>
        <SelectItem value="not_started">Not Started</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground">Intervention Cases</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} of {cases.length} cases
              {selectedCases.size > 0 && ` · ${selectedCases.size} selected`}
            </p>
          </div>
          <div data-tour="cases-actions" className="flex gap-2 flex-wrap justify-end">
            <CasesTour />
            {canManageAssignments && selectedCases.size > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setBulkAssignOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                Bulk Assign ({selectedCases.size})
              </Button>
            )}
            {canManageAssignments && (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Case
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card data-tour="cases-filters">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Advisors don't see department filter */}
              {!isAdvisor && (
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Category A">Category A</SelectItem>
                  <SelectItem value="Category B">Category B</SelectItem>
                </SelectContent>
              </Select>
              <StatusFilter value={filterMeeting} onChange={setFilterMeeting} label="Meeting" />
              <StatusFilter value={filterAip} onChange={setFilterAip} label="AIP" />
              <StatusFilter value={filterFollowUp} onChange={setFilterFollowUp} label="Follow-Up" />
              <StatusFilter value={filterOutcome} onChange={setFilterOutcome} label="Outcome" />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <XCircle className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card data-tour="cases-table">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManageAssignments && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && selectedCases.size === filtered.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead>AIP</TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger asChild><span className="cursor-help">Outcome</span></TooltipTrigger>
                      <TooltipContent>Intervention Outcome — based on meeting and final assessment</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageAssignments ? 11 : 10} className="text-center py-12 text-muted-foreground">
                      No intervention cases found. {hasFilters ? 'Try adjusting filters.' : 'Cases will appear once at-risk students are added.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => {
                    const outcomeInfo = getInterventionOutcomeLabel({
                      meeting_status: c.meeting_status,
                      outcome_status: c.outcome_status,
                      final_outcome: outcomes[c.case_id],
                    });
                    const workflow = getWorkflowState(c);
                    return (
                      <TableRow key={c.case_id}>
                        {canManageAssignments && (
                          <TableCell>
                            <Checkbox
                              checked={selectedCases.has(c.case_id)}
                              onCheckedChange={() => toggleSelection(c.case_id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs">{c.student_id}</TableCell>
                        <TableCell className="font-medium">{c.student_name}</TableCell>
                        <TableCell className="text-xs">{c.department}</TableCell>
                        <TableCell>
                          <Badge variant={c.risk_category === 'Category A' ? 'destructive' : 'secondary'} className="text-xs">
                            {c.risk_category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManageAssignments ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-xs font-normal"
                              onClick={() => {
                                setAssignTarget({
                                  caseId: c.case_id,
                                  advisorId: c.assigned_advisor,
                                  advisorName: c.assigned_advisor_name,
                                });
                                setAssignDialogOpen(true);
                              }}
                            >
                              {c.assigned_advisor_name || (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <UserPlus className="h-3 w-3" /> Assign
                                </span>
                              )}
                            </Button>
                          ) : (
                            c.assigned_advisor_name || <span className="text-muted-foreground text-xs">Not Assigned</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(c.meeting_status)}</TableCell>
                        <TableCell>{statusBadge(c.aip_status)}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span><Badge variant={outcomeInfo.variant} className="text-xs">{outcomeInfo.label}</Badge></span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {c.meeting_status !== 'completed'
                                ? 'Meeting has not been recorded yet. Schedule and complete the meeting first.'
                                : c.outcome_status !== 'completed'
                                  ? 'Meeting completed. Awaiting final outcome from administrator.'
                                  : 'Final intervention outcome has been recorded.'}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{workflow}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${c.case_id}`)} title="View Details">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {(user?.role === 'admin' || user?.role === 'department_chair') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget({ caseId: c.case_id, studentName: c.student_name });
                                  setDeleteDialogOpen(true);
                                }}
                                title="Delete"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <CreateCaseDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreated={loadCases} />
        <BulkImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImported={loadCases} />

        {deleteTarget && (
          <DeleteCaseDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            caseId={deleteTarget.caseId}
            studentName={deleteTarget.studentName}
            onDeleted={loadCases}
          />
        )}

        {assignTarget && (
          <AssignAdvisorDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            caseId={assignTarget.caseId}
            currentAdvisorId={assignTarget.advisorId}
            currentAdvisorName={assignTarget.advisorName}
            onUpdated={loadCases}
          />
        )}

        <BulkAssignDialog
          open={bulkAssignOpen}
          onOpenChange={setBulkAssignOpen}
          caseIds={Array.from(selectedCases)}
          onAssigned={loadCases}
        />
      </div>
    </AppLayout>
  );
};

export default CasesPage;
