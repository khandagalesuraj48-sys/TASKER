import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { useToast } from '../context/ToastContext';
import { getOrgEmployees, createOrgEmployee } from '../services/enterpriseService';
import { ErpEmployee } from '../types/enterprise';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

export const EmployeeDirectoryPage: React.FC = () => {
  const { currentOrg, isAdmin } = useEnterprise();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('Team Member');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadEmployees = async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const list = await getOrgEmployees(currentOrg.id);
      setEmployees(list);
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [currentOrg?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Only organization administrators can add employees to the directory.', 'error');
      return;
    }
    if (!currentOrg?.id || !firstName.trim() || !designation.trim()) {
      showToast('Name and designation are required.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrgEmployee(currentOrg.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        designation: designation.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      showToast('Employee added to directory.', 'success');
      setAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setDesignation('Team Member');
      setPhone('');
      setEmail('');
      loadEmployees();
    } catch (err: any) {
      showToast(err.message || 'Failed to add employee.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = employees.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
    return name.includes(q) || e.designation.toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Organization Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Employee Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentOrg?.legal_name || 'SAMAJ RACHANA CONSTRUCTION LIMITED'} — Staff & Team Members
          </p>
        </div>

        {isAdmin ? (
          <Button
            onClick={() => setAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Add New Employee
          </Button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Directory (Admin Managed)</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-md">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, role, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-2">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Employees Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAdmin
              ? 'Click "+ Add New Employee" to add a team member to the directory.'
              : 'No employees have been added to the directory by the administrator yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {emp.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {emp.first_name} {emp.last_name || ''}
                    </h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{emp.designation}</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {emp.employee_code}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-500">
                {emp.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                )}
                {emp.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{emp.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className={emp.user_id ? 'text-emerald-600 font-semibold' : 'text-slate-400 italic'}>
                    {emp.user_id ? 'Linked TASKER Account' : 'Directory Record Only'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Employee to Directory">
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Ramesh"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Shinde"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Designation *</label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Site Supervisor / Engineer"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@example.com"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Add to Directory
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
