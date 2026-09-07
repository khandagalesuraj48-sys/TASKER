import React, { useState, useEffect } from 'react';
import {
  Building2,
  FolderGit2,
  MapPin,
  Package,
  FileCheck2,
  ArrowUpRight,
  ArrowDownLeft,
  Filter
} from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getSiteStock } from '../services/erpInventoryService';
import { getErpInvoices } from '../services/erpAccountingService';
import { getErpApprovals } from '../services/erpApprovalService';
import { InventoryStock, ErpInvoice, ErpApproval } from '../types/enterprise';

export const ErpDashboardPage: React.FC = () => {
  const {
    currentOrg,
    projects,
    selectedProject,
    selectProject,
    sites,
    selectedSite,
    selectSite,
    departments,
    selectedDepartment,
    selectDepartment,
  } = useEnterprise();

  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [invoices, setInvoices] = useState<ErpInvoice[]>([]);
  const [approvals, setApprovals] = useState<ErpApproval[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      const st = await getSiteStock(selectedSite ? selectedSite.id : null, currentOrg?.id);
      setStock(st);
      const inv = await getErpInvoices(undefined, selectedProject ? selectedProject.id : null, currentOrg?.id);
      setInvoices(inv);
      const app = await getErpApprovals('pending', currentOrg?.id);
      setApprovals(app);
    };

    loadStats();
  }, [currentOrg, selectedProject, selectedSite, selectedDepartment]);

  const stockValuation = stock.reduce((acc, s) => acc + s.quantity_on_hand * s.valuation_rate, 0);
  const totalPayable = invoices.filter((i) => i.type === 'purchase').reduce((acc, i) => acc + (i.total_amount - i.paid_amount), 0);
  const totalReceivable = invoices.filter((i) => i.type === 'sales').reduce((acc, i) => acc + (i.total_amount - i.paid_amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Enterprise Scope Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span className="uppercase tracking-wider">Enterprise Scope & Multi-Site Filter</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Project Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Project
            </label>
            <select
              value={selectedProject ? selectedProject.id : ''}
              onChange={(e) => selectProject(e.target.value || null)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">All Projects (Consolidated)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Site Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Site / Yard
            </label>
            <select
              value={selectedSite ? selectedSite.id : ''}
              onChange={(e) => selectSite(e.target.value || null)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Department
            </label>
            <select
              value={selectedDepartment ? selectedDepartment.id : ''}
              onChange={(e) => selectDepartment(e.target.value || null)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span>{currentOrg?.legal_name || 'Enterprise ERP'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active Scope: {selectedProject ? selectedProject.name : 'All Projects'} • {selectedSite ? selectedSite.name : 'All Sites'} • GSTIN: {currentOrg?.gstin || 'N/A'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Site Stock Valuation</span>
            <Package className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{stockValuation.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{stock.length} materials tracked</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Vendor Payables</span>
            <ArrowUpRight className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            ₹{totalPayable.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Pending vendor bills</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Client Receivables</span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{totalReceivable.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Expected billing inflows</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Approvals</span>
            <FileCheck2 className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {approvals.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">POs and expenses requiring review</p>
        </div>
      </div>

      {/* Multi-Project & Multi-Site Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-blue-600" />
            <span>Active Enterprise Projects</span>
          </h3>

          <div className="space-y-3">
            {projects.map((prj) => (
              <div
                key={prj.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{prj.name}</span>
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-mono font-bold">
                    {prj.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{prj.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span>Budget: ₹{prj.budget.toLocaleString('en-IN')}</span>
                  <span className="capitalize">{prj.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sites List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Site Locations & Warehouses</span>
          </h3>

          <div className="space-y-3">
            {sites.map((st) => (
              <div
                key={st.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{st.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                    st.is_warehouse
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}>
                    {st.is_warehouse ? 'Warehouse Yard' : 'Project Site'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{st.address}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
