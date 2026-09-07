import React, { useEffect, useState } from 'react';
import {
  Contact,
  Building2,
  Plus,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Organization, ErpEmployee } from '../../types/enterprise';
import { useToast } from '../../context/ToastContext';

export const AdminDirectoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    designation: '',
    phone: '',
    employee_code: '',
  });

  useEffect(() => {
    loadOrgs();
  }, []);

  const loadOrgs = async () => {
    try {
      const data = await adminService.getAllOrganizations();
      setOrgs(data);
      if (data.length > 0) {
        setSelectedOrgId(data[0].id);
        loadDirectory(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load organizations', 'error');
      setLoading(false);
    }
  };

  const loadDirectory = async (orgId: string) => {
    setLoading(true);
    try {
      const data = await adminService.getOrgDirectory(orgId);
      setEmployees(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    loadDirectory(orgId);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !formData.first_name.trim() || !formData.designation.trim()) return;

    setIsSubmitting(true);
    try {
      await adminService.addOrgEmployee({
        org_id: selectedOrgId,
        first_name: formData.first_name,
        last_name: formData.last_name || undefined,
        email: formData.email || undefined,
        designation: formData.designation,
        phone: formData.phone || undefined,
        employee_code: formData.employee_code || undefined,
      });

      showToast(`Added ${formData.first_name} to directory`, 'success');
      setShowModal(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        designation: '',
        phone: '',
        employee_code: '',
      });
      loadDirectory(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to add employee', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = employees.filter(
    (emp) =>
      `${emp.first_name} ${emp.last_name || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase())) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Organization Staff Directory</h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain authorized organization directory staff available for workplace task assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDirectory(selectedOrgId)}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={!selectedOrgId}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Organization Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2 text-indigo-400">
          <Building2 className="w-5 h-5" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Organization:</span>
        </div>
        <select
          value={selectedOrgId}
          onChange={(e) => handleOrgChange(e.target.value)}
          className="px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-semibold max-w-sm"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.legal_name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          Total Employees in Directory: <strong className="text-white">{employees.length}</strong>
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search directory by name, code, designation, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <div
            key={emp.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {emp.first_name} {emp.last_name || ''}
                </h3>
                <span className="inline-block px-2 py-0.5 mt-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-[10px] font-bold">
                  {emp.employee_code}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {emp.status}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-300 font-semibold">{emp.designation}</span>
              </div>
              {emp.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
              )}
              {emp.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{emp.phone}</span>
                </div>
              )}
            </div>

            {emp.user_id && (
              <p className="text-[10px] text-slate-500 font-mono truncate pt-1 border-t border-slate-800/60">
                Auth UID: {emp.user_id}
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Contact className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">No employees found in directory</p>
            <p className="text-xs mt-1">Use the "+ Add Staff Member" button above to add staff.</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Contact className="w-4 h-4 text-indigo-400" />
                Add Staff to Organization Directory
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Designation / Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Engineer / Site Supervisor"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="staff@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Directory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
