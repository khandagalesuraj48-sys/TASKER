import React, { useState, useEffect } from 'react';
import { FileCheck2, Check, X } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getErpApprovals, actOnApproval } from '../services/erpApprovalService';
import { ErpApproval } from '../types/enterprise';
import { useToast } from '../context/ToastContext';

export const ErpApprovalsPage: React.FC = () => {
  const { currentOrg } = useEnterprise();
  const { showToast } = useToast();
  const [approvals, setApprovals] = useState<ErpApproval[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const loadData = async () => {
    if (!currentOrg) return;
    const list = await getErpApprovals(selectedFilter, currentOrg.id);
    setApprovals(list);
  };

  useEffect(() => {
    loadData();
  }, [currentOrg, selectedFilter]);

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    await actOnApproval(id, action);
    showToast(`Item marked as ${action}`, 'success');
    loadData();
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-amber-500" />
            <span>Enterprise Approvals Center</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authorize Purchase Orders, Subcontractor Bills, Site Petty Cash, and Variance Claims.
          </p>
        </div>

        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                selectedFilter === st
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {approvals.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <FileCheck2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No approvals in this queue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All site requisitions are up to date.</p>
          </div>
        ) : (
          approvals.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                    {item.entity_type}
                  </span>
                </div>
                {item.amount && (
                  <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                    Requisition Amount: ₹{item.amount.toLocaleString('en-IN')}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">Required Role: {item.assigned_role}</p>
              </div>

              {item.status === 'pending' && (
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleAction(item.id, 'rejected')}
                    className="px-3.5 py-1.5 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'approved')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
