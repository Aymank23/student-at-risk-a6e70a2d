import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import KpiCard from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetchAll';
import { CHART_COLORS } from '@/lib/constants';
import {
  AlertTriangle, Users, CheckCircle, Clock,
  FileText, TrendingUp, UserCheck, BookOpen,
  GraduationCap, Building2,
} from 'lucide-react';
import DashboardTour from '@/components/DashboardTour';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface DeptKpi {
  name: string;
  totalStudents: number;
  atRisk: number;
  catA: number;
  catB: number;
  catAPct: string;
  catBPct: string;
}

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalFlagged: 0, categoryA: 0, categoryB: 0,
    advisorsAssigned: 0, meetingsCompleted: 0,
    aipCompleted: 0, midtermReviews: 0, improved: 0,
    totalStudents: 0, atRiskPct: 0,
    meetingCount: 0, assignedCount: 0, aipCount: 0, meetingDoneCount: 0,
  });
  const [deptData, setDeptData] = useState<{ name: string; catA: number; catB: number }[]>([]);
  const [deptViewMode, setDeptViewMode] = useState<'department' | 'category'>('department');
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [funnelData, setFunnelData] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [deptKpis, setDeptKpis] = useState<DeptKpi[]>([]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    const [cases, outcomes, students, followUps] = await Promise.all([
      fetchAllRows('risk_cases'),
      fetchAllRows('outcomes'),
      fetchAllRows('students'),
      fetchAllRows('follow_ups', 'case_id'),
    ]);

    if (!cases.length) return;

    const totalStudents = students.length;
    const total = cases.length;
    const catA = cases.filter((c) => c.risk_category === 'Category A').length;
    const catB = cases.filter((c) => c.risk_category === 'Category B').length;
    const assigned = cases.filter((c) => c.assigned_advisor).length;
    const meetingsDone = cases.filter((c) => c.meeting_status === 'completed').length;
    const aipDone = cases.filter((c) => c.aip_status === 'completed').length;
    const midtermDone = cases.filter((c) => c.midterm_review_status === 'completed').length;
    const improvedCount = outcomes?.filter((o) => o.final_outcome === 'improved_above_threshold').length || 0;

    const followUpCaseIds = new Set(followUps?.map(f => f.case_id) || []);
    const followUpDone = cases.filter(c => followUpCaseIds.has(c.case_id)).length;
    const caseClosed = cases.filter(c => c.outcome_status === 'completed').length;

    // Strict KPI calculations
    // Advisors Assigned % = assigned / total
    // Meetings Done % = meetingsDone / assigned (of those assigned, how many met)
    // AIP Completed % = aipDone / meetingsDone (of those who met, how many have AIP)
    setStats({
      totalFlagged: total, categoryA: catA, categoryB: catB,
      advisorsAssigned: total > 0 ? Math.round((assigned / total) * 100) : 0,
      meetingsCompleted: assigned > 0 ? Math.round((meetingsDone / assigned) * 100) : 0,
      aipCompleted: meetingsDone > 0 ? Math.round((aipDone / meetingsDone) * 100) : 0,
      midtermReviews: meetingsDone > 0 ? Math.round((midtermDone / meetingsDone) * 100) : 0,
      improved: total > 0 ? Math.round((improvedCount / total) * 100) : 0,
      totalStudents,
      atRiskPct: totalStudents > 0 ? Math.round((total / totalStudents) * 100) : 0,
      meetingCount: meetingsDone,
      assignedCount: assigned,
      aipCount: aipDone,
      meetingDoneCount: meetingsDone,
    });

    // Department data with category breakdown
    const deptMap: Record<string, { catA: number; catB: number }> = {};
    cases.forEach((c) => {
      if (!deptMap[c.department]) deptMap[c.department] = { catA: 0, catB: 0 };
      if (c.risk_category === 'Category A') deptMap[c.department].catA++;
      else deptMap[c.department].catB++;
    });
    setDeptData(
      Object.entries(deptMap)
        .map(([name, d]) => ({ name, catA: d.catA, catB: d.catB }))
        .sort((a, b) => (b.catA + b.catB) - (a.catA + a.catB))
    );

    setStatusData([
      { name: 'Unassigned', value: cases.filter((c) => !c.assigned_advisor).length },
      { name: 'In Progress', value: cases.filter((c) => c.assigned_advisor && c.outcome_status !== 'completed').length },
      { name: 'Completed', value: caseClosed },
    ]);

    setFunnelData([
      { name: 'At-Risk Identified', value: total, fill: CHART_COLORS[0] },
      { name: 'Advisor Assigned', value: assigned, fill: CHART_COLORS[1] },
      { name: 'Meeting Conducted', value: meetingsDone, fill: CHART_COLORS[2] },
      { name: 'AIP Submitted', value: aipDone, fill: CHART_COLORS[3] },
      { name: 'Follow-Up Done', value: followUpDone, fill: CHART_COLORS[4] },
      { name: 'Case Closed', value: caseClosed, fill: CHART_COLORS[0] },
    ]);

    // Department KPIs
    const deptStudentMap: Record<string, number> = {};
    students?.forEach((s: any) => {
      deptStudentMap[s.department] = (deptStudentMap[s.department] || 0) + 1;
    });

    const allDepts = new Set([...Object.keys(deptMap), ...Object.keys(deptStudentMap)]);
    const kpis: DeptKpi[] = Array.from(allDepts).map(dept => {
      const deptCases = cases.filter(c => c.department === dept);
      const ts = deptStudentMap[dept] || 0;
      const ar = deptCases.length;
      const ca = deptCases.filter(c => c.risk_category === 'Category A').length;
      const cb = deptCases.filter(c => c.risk_category === 'Category B').length;
      return {
        name: dept,
        totalStudents: ts,
        atRisk: ar,
        catA: ca,
        catB: cb,
        catAPct: ts > 0 ? `${Math.round((ca / ts) * 100)}%` : '0%',
        catBPct: ts > 0 ? `${Math.round((cb / ts) * 100)}%` : '0%',
      };
    }).sort((a, b) => b.atRisk - a.atRisk);
    setDeptKpis(kpis);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground">Executive ARIP Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time academic risk intervention overview</p>
          </div>
          <DashboardTour />
        </div>

        {/* School-Level KPIs */}
        <div data-tour="kpi-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard title="Total Students" value={stats.totalStudents} icon={GraduationCap} />
          <KpiCard title="Total At-Risk" value={stats.totalFlagged} icon={AlertTriangle} variant="warning" />
          <KpiCard title="% At-Risk" value={`${stats.atRiskPct}%`} icon={Users} variant={stats.atRiskPct > 20 ? 'destructive' : 'warning'} />
          <KpiCard title="Category A" value={stats.categoryA} subtitle="<45 credits, CGPA ≤2.3" icon={BookOpen} variant="destructive" />
          <KpiCard title="Category B" value={stats.categoryB} subtitle="≥45 credits, CGPA ≤2.2" icon={BookOpen} variant="warning" />
        </div>

        <div data-tour="progress-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Advisors Assigned" value={`${stats.advisorsAssigned}%`} subtitle={`${stats.assignedCount} of ${stats.totalFlagged} students`} icon={UserCheck} />
          <KpiCard title="Meetings Done" value={`${stats.meetingsCompleted}%`} subtitle={`${stats.meetingCount} of ${stats.assignedCount} assigned`} icon={CheckCircle} variant="success" />
          <KpiCard title="AIP Completed" value={`${stats.aipCompleted}%`} subtitle={`${stats.aipCount} of ${stats.meetingDoneCount} with meetings`} icon={FileText} />
          <KpiCard title="Improved" value={`${stats.improved}%`} subtitle="of total at-risk" icon={TrendingUp} variant="success" />
        </div>

        {/* ARIP Compliance Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-sans font-medium">ARIP Compliance Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {funnelData.map((stage, i) => {
                const prevValue = i > 0 ? funnelData[i - 1].value : stage.value;
                const conversionRate = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 0;
                return (
                  <div key={stage.name} className="text-center">
                    <div
                      className="mx-auto rounded-lg flex items-center justify-center font-semibold text-primary-foreground text-lg"
                      style={{
                        backgroundColor: stage.fill,
                        width: `${Math.max(40, 100 - i * 10)}%`,
                        height: '64px',
                      }}
                    >
                      {stage.value}
                    </div>
                    <p className="text-xs font-medium mt-2 text-foreground">{stage.name}</p>
                    {i > 0 && (
                      <p className="text-xs text-muted-foreground">{conversionRate}% conversion</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Students at Risk by Department / Category toggle */}
          <Card data-tour="dept-chart">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-sans font-medium">Students at Risk</CardTitle>
                <Tabs value={deptViewMode} onValueChange={(v) => setDeptViewMode(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="department" className="text-xs px-2 py-1">By Department</TabsTrigger>
                    <TabsTrigger value="category" className="text-xs px-2 py-1">By Category</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                {deptViewMode === 'department' ? (
                  <BarChart data={deptData} margin={{ bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="catA" name="Category A" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="catB" name="Category B" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={[
                    { name: 'Category A', value: stats.categoryA },
                    { name: 'Category B', value: stats.categoryB },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Students" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
                      <Cell fill={CHART_COLORS[0]} />
                      <Cell fill={CHART_COLORS[2]} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Case Status Distribution - fix overlapping labels */}
          <Card data-tour="status-chart">
            <CardHeader>
              <CardTitle className="text-base font-sans font-medium">Case Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    label={false}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value} />
                  <Legend
                    formatter={(value, entry: any) => {
                      const item = statusData.find(s => s.name === value);
                      return `${value}: ${item?.value || 0}`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Department KPI Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Department Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Total Students</TableHead>
                  <TableHead>At-Risk</TableHead>
                  <TableHead>Cat A</TableHead>
                  <TableHead>Cat A %</TableHead>
                  <TableHead>Cat B</TableHead>
                  <TableHead>Cat B %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptKpis.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.totalStudents}</TableCell>
                    <TableCell>{d.atRisk}</TableCell>
                    <TableCell>{d.catA}</TableCell>
                    <TableCell>{d.catAPct}</TableCell>
                    <TableCell>{d.catB}</TableCell>
                    <TableCell>{d.catBPct}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
