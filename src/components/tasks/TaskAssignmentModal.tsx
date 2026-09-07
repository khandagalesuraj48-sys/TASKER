import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task } from '../../types/task';
import { ErpEmployee } from '../../types/enterprise';
import { getOrgEmployees, quickCreateEmployee, assignTask } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { UserPlus, Search } from 'lucide-react';

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onAssigned?: () => void;
}

export const TaskAssignmentModal: React.FC<TaskAssignmentModalProps> = ({
  isOpen,
  onClose,
  task,
  onAssigned,
}) => {
  const { showToast } = useToast();
  const { currentOrg } = useEnterprise();

  const activeOrgId = task.org_id || currentOrg?.id;

  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    task.assigned_employee_id || null
  );
  const [remark, setRemark] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Add State
  const [showQuickAdd, setShowQuickAdd] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpDesignation, setNewEmpDesignation] = useState<string>('Team Member');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('');
  const [isCreatingEmp, setIsCreatingEmp] = useState<boolean>(false);

  const loadEmployees = async () => {
    if (!activeOrgId) return;
    setIsLoading(true);
    try {
      const data = await getOrgEmployees(activeOrgId);
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeOrgId) {
      loadEmployees();
      setSelectedEmployeeId(task.assigned_employee_id || null);
      setRemark('');
      setShowQuickAdd(false);
      setSearchTerm('');
    }
  }, [isOpen, activeOrgId, task.id]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      showToast('Person name is required.', 'error');
      return;
    }
    if (!activeOrgId) {
      showToast('Please select an active organization first.', 'error');
      return;
    }

    setIsCreatingEmp(true);
    try {
      const created = await quickCreateEmployee(
        activeOrgId,
        newEmpName.trim(),
        newEmpDesignation.trim() || 'Team Member',
        newEmpPhone.trim() || undefined
      );
      showToast(`Added ${created.first_name} to employee directory!`, 'success');
      await loadEmployees();
      setSelectedEmployeeId(created.id);
      setShowQuickAdd(false);
      setNewEmpName('');
      setNewEmpPhone('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add employee.', 'error');
    } finally {
      setIsCreatingEmp(false);
    }
  };

  const handleAssign = async () => {
    if (!activeOrgId) {
      showToast('No active organization found for workplace assignment.', 'error');
      return;
    }

    const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
    const assignedName = selectedEmp
      ? `${selectedEmp.first_name} ${selectedEmp.last_name || ''}`.trim()
      : null;

    setIsSubmitting(true);
    try {
      await assignTask(task.id, {
        orgId: activeOrgId,
        assignedEmployeeId: selectedEmployeeId,
        assignedTo: selectedEmp?.user_id || null,
        assignedToName: assignedName,
        remark: remark.trim() || undefined,
      });

      showToast(`Task assigned to ${assignedName || 'selected person'}.`, 'success');
      onAssigned?.();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign task.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const fullName = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
    const desig = (e.designation || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return fullName.includes(q) || desig.includes(q);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Workplace Task"
      subtitle={`Assign or hand over "${task.title}" to an employee`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {!activeOrgId ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
            Please select or configure an organization in Enterprise mode to enable workplace employee assignments.
          </div>
        ) : (
          <>
            {/* Search & Employee Directory */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Assignee / Pending With
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showQuickAdd ? 'Cancel Quick Add' : '+ Quick Add Person'}</span>
                </button>
              </div>

              {/* Quick Add Form */}
              {showQuickAdd && (
                <form
                  onSubmit={handleQuickAdd}
                  className="mb-3 p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2.5"
                >
                  <div className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                    Add Person to Workplace Directory
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      required
                      placeholder="Full Name *"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Designation / Role"
                      value={newEmpDesignation}
                      onChange={(e) => setNewEmpDesignation(e.target.value)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      type="submit"
                      isLoading={isCreatingEmp}
                    >
                      Save & Select
                    </Button>
                  </div>
                </form>
              )}

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employees by name or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Employee Selection List */}
              <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading directory...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No employees found matching "{searchTerm}". Use "+ Quick Add Person" above to create one.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmployeeId === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {emp.first_name} {emp.last_name || ''}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {emp.designation} • {emp.employee_code}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Current Assignee Context Banner */}
            {task.person_name && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{task.person_name}</span>
                {selectedEmployeeId && (
                  <>
                    <span className="text-slate-400">➔</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">Handing Over To:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {employees.find((e) => e.id === selectedEmployeeId)?.first_name}{' '}
                      {employees.find((e) => e.id === selectedEmployeeId)?.last_name || ''}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Assignment Remark / New Action Instructions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  🎯 Clear Instructions / Next Step for Assignee
                </label>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Shown prominently to assignee</span>
              </div>
              <textarea
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={
                  task.person_name
                    ? `उदा. ${task.person_name} कडून हे काम झाले आहे. आता पुढील व्यक्तीने काय करायचे आहे ते येथे स्पष्ट लिहा...`
                    : 'उदा. क्लायंटकडून कागदपत्रे गोळा करा आणि संध्याकाळी ५ वाजेपर्यंत रिपोर्ट सादर करा...'
                }
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                💡 ही सूचना नवीन व्यक्तीला टास्क उघडल्यावर सर्वात वर ठळकपणे दिसेल, ज्यामुळे त्याचा गोंधळ होणार नाही.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssign}
                isLoading={isSubmitting}
                disabled={!selectedEmployeeId}
              >
                Confirm Assignment
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
