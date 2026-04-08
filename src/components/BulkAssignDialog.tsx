import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { loadAdvisors, type Advisor } from '@/lib/advisors';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseIds: string[];
  onAssigned: () => void;
}

const BulkAssignDialog = ({ open, onOpenChange, caseIds, onAssigned }: BulkAssignDialogProps) => {
  const { user } = useAuth();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadAdvisors().then((all) => {
        if (user?.role === 'department_chair' && user.department) {
          setAdvisors(all.filter(a => a.department === user.department));
        } else {
          setAdvisors(all);
        }
      });
      setSelectedAdvisor('');
    }
  }, [open, user]);

  const handleBulkAssign = async () => {
    if (!selectedAdvisor || caseIds.length === 0) return;
    setSaving(true);

    const advisor = advisors.find(a => a.advisor_id === selectedAdvisor);
    if (!advisor) { setSaving(false); return; }

    const newTotal = advisor.case_count + caseIds.length;
    if (newTotal > 10) {
      toast.error(`This advisor can only take ${10 - advisor.case_count} more cases (max 10).`);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('risk_cases').update({
      assigned_advisor: selectedAdvisor,
      assigned_advisor_name: advisor.name,
    }).in('case_id', caseIds);

    if (error) {
      toast.error('Failed to assign advisor.');
      setSaving(false);
      return;
    }

    await supabase.from('audit_log').insert({
      action: 'bulk_advisor_assigned',
      user_id: user?.id || null,
      details: {
        advisor_name: advisor.name,
        case_count: caseIds.length,
        assigned_by: user?.full_name,
      },
    });

    toast.success(`${caseIds.length} case(s) assigned to ${advisor.name}.`);
    setSaving(false);
    onOpenChange(false);
    onAssigned();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Assign Advisor
          </DialogTitle>
          <DialogDescription>
            Assign <strong>{caseIds.length}</strong> selected student(s) to a single advisor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Advisor</Label>
            <Select value={selectedAdvisor} onValueChange={setSelectedAdvisor}>
              <SelectTrigger>
                <SelectValue placeholder="Choose advisor..." />
              </SelectTrigger>
              <SelectContent>
                {advisors.map((a) => (
                  <SelectItem key={a.advisor_id} value={a.advisor_id} disabled={a.case_count + caseIds.length > 10}>
                    {a.name} ({a.department || 'No Dept'}) — {a.case_count}/10 cases
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!selectedAdvisor || saving} className="flex-1">
              {saving ? 'Assigning...' : `Assign ${caseIds.length} Case(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAssignDialog;
