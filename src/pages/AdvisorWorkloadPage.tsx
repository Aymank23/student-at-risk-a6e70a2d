import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import KpiCard from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CHART_COLORS } from '@/lib/constants';
import { Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdvisorWorkloadTour from '@/components/AdvisorWorkloadTour';

const AdvisorWorkloadPage = () => {
  const { user } = useAuth();
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deptSummary, setDeptSummary] = useState({ total: 0, assigned: 0, unassigned: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: users } = await supabase.from('app_users').select('*').eq('role', 'advisor').eq('status', 'active');
    let caseQuery = supabase.from('risk_cases').select('*');

    if (user?.role === 'department_chair' && user.department) {
      caseQuery = caseQuery.eq('department', user.department);
    }

    const [{ data: cases }, { data: followUps }, { data: interventions }] = await Promise.all([
      caseQuery,
      supabase.from('follow_ups').select('case_id'),
      supabase.from('intervention_forms').select('case_id'),
    ]);

    if (!users || !cases) return;

    const followUpSet = new Set(followUps?.map(f => f.case_id) || []);
    const interventionSet = new Set(interventions?.map(f => f.case_id) || []);

    let filteredUsers = users;
    if (user?.role === 'department_chair' && user.department) {
      filteredUsers = users.filter(u => u.department === user.department);
    }

    const advisorStats = filteredUsers.map((u) => {
      const myCases = cases.filter((c) => c.assigned_advisor === u.user_id);
      const pendingMeeting = myCases.filter(c => c.meeting_status !== 'completed' && c.outcome_status !== 'completed').length;
      const meetingCompleted = myCases.filter(c => c.meeting_status === 'completed').length;
      const followUpRequired = myCases.filter(c => c.aip_status === 'completed' && !followUpSet.has(c.case_id)).length;
      const caseClosed = myCases.filter(c => c.outcome_status === 'completed').length;
      const followUpsDone = myCases.filter(c => followUpSet.has(c.case_id)).length;

      return {
        name: u.full_name,
        department: u.department || 'No Data',
        assigned: myCases.length,
        pendingMeeting,
        meetingCompleted,
        aipSubmitted: myCases.filter(c => interventionSet.has(c.case_id)).length,
        followUpRequired,
        followUpsDone,
        caseClosed,
      };
    });

    setAdvisors(advisorStats);
    setChartData(advisorStats.map((a) => ({
      name: a.name,
      'Pending Meeting': a.pendingMeeting,
      'Meeting Completed': a.meetingCompleted,
      'Follow-Up Done': a.followUpsDone,
      'Case Closed': a.caseClosed,
    })));

    const totalCases = cases.length;
    const assignedCases = cases.filter(c => c.assigned_advisor).length;
    setDeptSummary({
      total: totalCases,
      assigned: assignedCases,
      unassigned: totalCases - assignedCases,
    });
  };

  const totalAssigned = advisors.reduce((s, a) => s + a.assigned, 0);
  const totalPending = advisors.reduce((s, a) => s + a.pendingMeeting, 0);
  const totalFollowUpsDone = advisors.reduce((s, a) => s + a.followUpsDone, 0);
  const totalClosed = advisors.reduce((s, a) => s + a.caseClosed, 0);

  const isDeptChair = user?.role === 'department_chair';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground">
              {isDeptChair ? `${user?.department} — Advisor Workload` : 'Advisor Workload'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor advisor assignments and workflow-based case progress
            </p>
          </div>
          <AdvisorWorkloadTour />
        </div>

        {isDeptChair && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard title="Total Cases" value={deptSummary.total} icon={Users} />
            <KpiCard title="Assigned" value={deptSummary.assigned} icon={CheckCircle} variant="success" />
            <KpiCard title="Unassigned" value={deptSummary.unassigned} icon={AlertTriangle} variant="warning" />
          </div>
        )}

        <div data-tour="workload-kpis" className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard title="Assigned Cases" value={totalAssigned} icon={Users} />
          <KpiCard title="Pending Meetings" value={totalPending} icon={Clock} variant="warning" />
          <KpiCard title="Follow-Ups Done" value={totalFollowUpsDone} icon={CheckCircle} variant="success" />
          <KpiCard title="Cases Closed" value={totalClosed} icon={CheckCircle} variant="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-tour="workload-chart">
            <CardHeader><CardTitle className="text-base font-sans font-medium">Workflow Distribution by Advisor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="Pending Meeting" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Meeting Completed" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Follow-Up Done" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Case Closed" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-tour="workload-table">
            <CardHeader><CardTitle className="text-base font-sans font-medium">Advisor Performance</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advisor</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Meetings</TableHead>
                    <TableHead>AIP</TableHead>
                    <TableHead>Follow-Ups</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advisors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No advisors found</TableCell>
                    </TableRow>
                  ) : (
                    advisors.map((a) => (
                      <TableRow key={a.name}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-xs">{a.department}</TableCell>
                        <TableCell>
                          <Badge variant={a.assigned >= 10 ? 'destructive' : 'secondary'}>{a.assigned}/10</Badge>
                        </TableCell>
                        <TableCell>{a.pendingMeeting}</TableCell>
                        <TableCell>{a.meetingCompleted}/{a.assigned}</TableCell>
                        <TableCell>{a.aipSubmitted}/{a.assigned}</TableCell>
                        <TableCell>{a.followUpsDone}/{a.assigned}</TableCell>
                        <TableCell>{a.caseClosed}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdvisorWorkloadPage;
