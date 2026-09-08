import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task, TaskPriority } from '../../types/task';
import { ErpEmployee } from '../../types/enterprise';
import { getOrgEmployees } from '../../services/taskService';
import { createSubtask } from '../../services/subtaskService';
import { useToast } from '../../context/ToastContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAuth } from '../../context/AuthContext';
import { 
  GitFork,
  CheckCircle2,
  Search 
} from 'lucide-react';

interface DelegateSubtaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentTask: Task;
  onSubtaskCreated?: () => void;
}

export const DelegateSubtaskModal: React.FC<DelegateSubtaskModalProps> = ({
  isOpen,
  onClose,
  parentTask,
  onSubtaskCreated,
}) => {
  const { currentOrg } = useEnterprise();
  const { displayName, userEmail } = useAuth();
  const { showToast } = useToast();

  const activeOrgId = parentTask.org_id || currentOrg?.id;

  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [isLoadingEmps, setIsLoadingEmps] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(parentTask.due_date ? parentTask.due_date.slice(0, 10) : '');
  const [priority, setPriority] = useState<TaskPriority>(parentTask.priority || 'medium');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const quickActionChips = [
    'Attach Log Book',
    'Upload Site Photos',
    'Client Sign-off Proof',
    'Material Delivery Verification',
    'Site Safety Check',
  ];

  useEffect(() => {
    if (isOpen && activeOrgId) {
      loadEmployees();
      setTitle('');
      setDescription('');
      setSelectedEmployeeId('');
      setDueDate(parentTask.due_date ? parentTask.due_date.slice(0, 10) : '');
      setPriority(parentTask.priority || 'medium');
      setSearchTerm('');
    }
  }, [isOpen, activeOrgId, parentTask.id]);

  const loadEmployees = async () => {
    if (!activeOrgId) return;
    setIsLoadingEmps(true);
    try {
      const data = await getOrgEmployees(activeOrgId);
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load organization employees:', err);
    } finally {
      setIsLoadingEmps(false);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const fullName = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
    const desig = (e.designation || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return fullName.includes(q) || desig.includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter the subtask deliverable / requirement.', 'error');
      return;
    }

    const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
    const assignedName = selectedEmp
      ? `${selectedEmp.first_name} ${selectedEmp.last_name || ''}`.trim()
      : null;

    setIsSubmitting(true);
    try {
      await createSubtask(
        parentTask,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedToUserId: selectedEmp?.user_id || null,
          assignedEmployeeId: selectedEmp?.id || null,
          assignedToName: assignedName,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          priority,
        },
        displayName || userEmail || undefined
      );

      showToast(
        `Subtask delegated to ${assignedName || 'assignee'} successfully!`,
        'success'
      );
      onSubtaskCreated?.();
      onClose();
    } catch (err: any) {
      console.error('Delegate subtask error:', err);
      showToast(err.message || 'Failed to delegate subtask.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delegate Subtask"
      subtitle={`Action item under "${parentTask.title}"`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context info banner */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-primary shrink-0" />
            <span>Parent Task: <strong className="text-foreground">{parentTask.title}</strong></span>
          </div>
          {parentTask.person_name && (
            <span className="text-[11px] text-muted-foreground">
              Assigned: {parentTask.person_name}
            </span>
          )}
        </div>

        {/* Quick Action Suggestion Chips */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Quick Requirement
          </label>
          <div className="flex flex-wrap gap-1.5">
            {quickActionChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setTitle(chip)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-all text-left font-medium ${
                  title === chip
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Subtask Title Input */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Subtask Requirement / Action Item *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Attach log book signed by site supervisor"
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Assignee Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">
              Delegate To (Assignee)
            </label>
            {employees.length > 5 && (
              <div className="relative w-36">
                <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 text-[11px] rounded-md border border-border bg-card text-foreground"
                />
              </div>
            )}
          </div>

          {isLoadingEmps ? (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
              Loading team directory...
            </div>
          ) : employees.length === 0 ? (
            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground text-center">
              No organization team members found. You can still create an unassigned subtask.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployeeId === emp.id;
                const fullName = `${emp.first_name} ${emp.last_name || ''}`.trim();
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmployeeId(isSelected ? '' : emp.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left border transition-all text-xs ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground font-semibold'
                        : 'bg-card border-border text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{fullName}</div>
                      <div className="truncate text-[10px] text-muted-foreground font-normal">
                        {emp.designation || 'Team Member'}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Due Date & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Additional Instructions */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Instructions / Deliverable Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any specific guidelines for log book format, site photos, or client signature..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? 'Delegating...' : 'Delegate Subtask'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
