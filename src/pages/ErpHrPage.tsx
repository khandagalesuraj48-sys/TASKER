import React, { useState, useEffect } from 'react';
import { useEnterprise } from '../context/EnterpriseContext';
import { ErpEmployee } from '../types/enterprise';
import { getErpEmployees, createErpEmployee, getErpAttendance, markErpAttendance } from '../services/erpHrService';
import { UserCheck, Calendar, Plus } from 'lucide-react';

export const ErpHrPage: React.FC = () => {
  const { currentOrg, selectedProject, selectedSite } = useEnterprise();
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'half_day' | 'overtime'>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [dailyWage, setDailyWage] = useState('');

  const loadData = async () => {
    const empList = await getErpEmployees(currentOrg?.id, selectedProject?.id, selectedSite?.id);
    setEmployees(empList);

    const attList = await getErpAttendance(selectedDate, selectedSite?.id, currentOrg?.id);
    const map: Record<string, 'present' | 'absent' | 'half_day' | 'overtime'> = {};
    attList.forEach((att) => {
      map[att.employee_id] = att.status;
    });
    setAttendanceRecords(map);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedProject, selectedSite, currentOrg]);

  const handleSetStatus = (empId: string, status: 'present' | 'absent' | 'half_day' | 'overtime') => {
    setAttendanceRecords((prev) => ({ ...prev, [empId]: status }));
  };

  const handleSaveAttendance = async () => {
    const records = employees.map((emp) => ({
      org_id: currentOrg?.id || 'org_enterprise_default',
      project_id: emp.project_id || selectedProject?.id || 'proj_metro_line_3',
      site_id: emp.site_id || selectedSite?.id || 'site_mumbai_cst',
      employee_id: emp.id,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      date: selectedDate,
      status: attendanceRecords[emp.id] || 'present',
    }));

    await markErpAttendance(records);
    alert('Site Attendance Logged Successfully!');
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !designation) return;

    await createErpEmployee({
      org_id: currentOrg?.id || 'org_enterprise_default',
      project_id: selectedProject?.id || 'proj_metro_line_3',
      site_id: selectedSite?.id || 'site_mumbai_cst',
      first_name: firstName,
      last_name: lastName,
      employee_code: empCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      designation: designation,
      phone: phone || null,
      salary: parseFloat(salary) || null,
      daily_wage: parseFloat(dailyWage) || null,
      status: 'active',
    });

    setIsAddModalOpen(false);
    setFirstName('');
    setLastName('');
    setEmpCode('');
    setDesignation('');
    setPhone('');
    setSalary('');
    setDailyWage('');
    loadData();
  };

  const presentCount = Object.values(attendanceRecords).filter((s) => s === 'present' || s === 'overtime').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">HR & Site Workforce</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Site engineers, supervisors, daily attendance muster & wage allocations.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Enroll New Employee
        </button>
      </div>

      {/* Date & Site Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
          />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Attendance Muster ({presentCount}/{employees.length} Present)
          </span>
        </div>

        <button
          onClick={handleSaveAttendance}
          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all self-end sm:self-auto"
        >
          Save Daily Muster
        </button>
      </div>

      {/* Employee Attendance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Emp Code & Name</th>
                <th className="p-4">Designation</th>
                <th className="p-4">Rate / Wage</th>
                <th className="p-4">Status for {selectedDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {employees.map((emp) => {
                const currentStatus = attendanceRecords[emp.id] || 'present';
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{emp.employee_code}</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {emp.designation}
                    </td>
                    <td className="p-4">
                      {emp.daily_wage ? (
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{emp.daily_wage}/day
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">₹{emp.salary}/mo</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {(['present', 'half_day', 'overtime', 'absent'] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleSetStatus(emp.id, status)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                              currentStatus === status
                                ? status === 'present'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : status === 'absent'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Enroll Site Personnel</h3>

            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patil"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Site Supervisor"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employee Code</label>
                  <input
                    type="text"
                    placeholder="Auto or EMP-101"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Daily Wage (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1500"
                    value={dailyWage}
                    onChange={(e) => setDailyWage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 45000"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ErpHrPage;
