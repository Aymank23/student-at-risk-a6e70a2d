import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import KpiCard from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CHART_COLORS } from '@/lib/constants';
import { TrendingUp, TrendingDown, ArrowRight, XCircle, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const OutcomesPage = () => {
  const { user } = useAuth();
  const [outcomeStats, setOutcomeStats] = useState<{ name: string; value: number }[]>([]);
  const [totals, setTotals] = useState({ improved: 0, stillAtRisk: 0, declined: 0, withdrew: 0, other: 0, total: 0 });
  const [deptOutcomes, setDeptOutcomes] = useState<any[]>([]);
  const [followUpEffectiveness, setFollowUpEffectiveness] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    let caseQuery = supabase.from('risk_cases').select('*');
    if (user?.role === 'department_chair' && user.department) {
      caseQuery = caseQuery.eq('department', user.department);
    }
    const [{ data: cases }, { data: outcomes }, { data: followUps }] = await Promise.all([
      caseQuery,
      supabase.from('outcomes').select('*'),
      supabase.from('follow_ups').select('case_id'),
    ]);

    if (!cases) return;

    const caseIds = new Set(cases.map(c => c.case_id));
    const relevantOutcomes = outcomes?.filter(o => caseIds.has(o.case_id)) || [];
    const followUpSet = new Set(followUps?.map(f => f.case_id) || []);

    const total = relevantOutcomes.length;
    const improved = relevantOutcomes.filter((o) => o.final_outcome === 'improved_above_threshold').length;
    const stillAtRisk = relevantOutcomes.filter((o) => o.final_outcome === 'improved_still_at_risk').length;
    const declined = relevantOutcomes.filter((o) => o.final_outcome === 'declined_escalated').length;
    const withdrew = relevantOutcomes.filter((o) => o.final_outcome === 'withdrew').length;
    const other = relevantOutcomes.filter((o) => o.final_outcome === 'other').length;

    setTotals({ improved, stillAtRisk, declined, withdrew, other, total });

    const stats = [
      { name: 'Improved', value: improved },
      { name: 'Still At Risk', value: stillAtRisk },
      { name: 'Declined', value: declined },
      { name: 'Withdrew', value: withdrew },
    ];
    if (other > 0) stats.push({ name: 'Other', value: other });
    setOutcomeStats(stats.filter(s => s.value > 0));

    // Department-level outcome breakdown
    const deptMap: Record<string, { improved: number; declined: number; total: number }> = {};
    relevantOutcomes.forEach(o => {
      const c = cases.find(ca => ca.case_id === o.case_id);
      if (!c) return;
      if (!deptMap[c.department]) deptMap[c.department] = { improved: 0, declined: 0, total: 0 };
      deptMap[c.department].total++;
      if (o.final_outcome === 'improved_above_threshold') deptMap[c.department].improved++;
      if (o.final_outcome === 'declined_escalated') deptMap[c.department].declined++;
    });
    setDeptOutcomes(Object.entries(deptMap).map(([name, d]) => ({ name, ...d })));

    // Follow-up effectiveness: cases with follow-ups vs without
    const withFollowUp = relevantOutcomes.filter(o => followUpSet.has(o.case_id));
    const withoutFollowUp = relevantOutcomes.filter(o => !followUpSet.has(o.case_id));
    const improvedWith = withFollowUp.filter(o => o.final_outcome === 'improved_above_threshold').length;
    const improvedWithout = withoutFollowUp.filter(o => o.final_outcome === 'improved_above_threshold').length;
    setFollowUpEffectiveness([
      { name: 'With Follow-Up', improved: improvedWith, total: withFollowUp.length },
      { name: 'Without Follow-Up', improved: improvedWithout, total: withoutFollowUp.length },
    ]);
  };

  const rate = (n: number) => totals.total > 0 ? `${Math.round((n / totals.total) * 100)}%` : '0%';
  const hasData = totals.total > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Intervention Outcome Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track intervention effectiveness and student outcomes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard title="Improvement Rate" value={rate(totals.improved)} subtitle={`${totals.improved} of ${totals.total}`} icon={TrendingUp} variant="success" />
          <KpiCard title="Still At Risk" value={rate(totals.stillAtRisk)} subtitle={`${totals.stillAtRisk} cases`} icon={ArrowRight} variant="warning" />
          <KpiCard title="Declined" value={rate(totals.declined)} subtitle={`${totals.declined} cases`} icon={TrendingDown} variant="destructive" />
          <KpiCard title="Withdrew" value={rate(totals.withdrew)} subtitle={`${totals.withdrew} cases`} icon={XCircle} />
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Outcome Data Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Outcome analytics will populate once administrators record intervention outcomes for completed cases.
                Navigate to individual case pages to record outcomes after the full intervention workflow is completed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base font-sans font-medium">Outcome Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={outcomeStats} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" labelLine={{ strokeWidth: 1 }} label={({ name, value }) => `${name}: ${value}`}>
                        {outcomeStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base font-sans font-medium">Follow-Up Effectiveness</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={followUpEffectiveness}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="improved" name="Improved" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" name="Total Outcomes" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {deptOutcomes.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base font-sans font-medium">Outcomes by Department</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Total Outcomes</TableHead>
                        <TableHead>Improved</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Declined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptOutcomes.map((d) => (
                        <TableRow key={d.name}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>{d.total}</TableCell>
                          <TableCell>{d.improved}</TableCell>
                          <TableCell>{d.total > 0 ? `${Math.round((d.improved / d.total) * 100)}%` : '0%'}</TableCell>
                          <TableCell>{d.declined}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default OutcomesPage;
