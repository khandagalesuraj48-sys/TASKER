import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ExternalLink,
  Trash2,
  DollarSign
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { FinancialRecord, FinancialType } from '../types/finance';
import {
  getFinancialRecords,
  createFinancialRecord,
  recordPayment,
  deleteFinancialRecord,
  generateUpiUrl,
} from '../services/financeService';
import { useToast } from '../context/ToastContext';

export const FinancePage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'bill' | 'obligation' | 'p2p_loan'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payModalRecord, setPayModalRecord] = useState<FinancialRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'upi' | 'cash' | 'netbanking'>('upi');

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<FinancialType>('bill');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    if (!currentWorkspace) return;
    const data = await getFinancialRecords(currentWorkspace.id);
    setRecords(data);
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !title.trim() || !amount) return;

    await createFinancialRecord({
      workspace_id: currentWorkspace.id,
      title: title.trim(),
      type,
      amount: parseFloat(amount),
      currency: 'INR',
      due_date: new Date(dueDate).toISOString(),
      status: 'unpaid',
      category: category.trim() || null,
      contact_name: contactName.trim() || null,
      upi_id: upiId.trim() || null,
      notes: notes.trim() || null,
    });

    showToast('Financial record saved successfully', 'success');
    setIsModalOpen(false);
    setTitle('');
    setAmount('');
    setContactName('');
    setUpiId('');
    setNotes('');
    loadData();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalRecord || !payAmount) return;

    await recordPayment(payModalRecord.id, {
      amount: parseFloat(payAmount),
      method: payMethod,
      notes: 'Recorded from TASKER UI',
    });

    showToast('Payment recorded successfully', 'success');
    setPayModalRecord(null);
    setPayAmount('');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this financial record?')) {
      await deleteFinancialRecord(id);
      showToast('Record deleted', 'info');
      loadData();
    }
  };

  const filtered = records.filter((r) => activeTab === 'all' || r.type === activeTab);

  const totalPayable = records
    .filter((r) => r.type === 'bill' || r.type === 'obligation' || r.type === 'payable')
    .reduce((acc, r) => acc + (r.amount - r.paid_amount), 0);

  const totalReceivable = records
    .filter((r) => r.type === 'p2p_loan' || r.type === 'receivable')
    .reduce((acc, r) => acc + (r.amount - r.paid_amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Finance & Bills Tracker</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track utility bills, loans, EMIs, and Hisab/Udhar with direct UPI payments.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Record</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Pending Outflow</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">₹{totalPayable.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Pending Inflow (Udhar)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">₹{totalReceivable.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Active Records</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{records.length}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {(['all', 'bill', 'obligation', 'p2p_loan'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab === 'all'
              ? 'All Records'
              : tab === 'bill'
              ? 'Bills & Utilities'
              : tab === 'obligation'
              ? 'EMIs & Dues'
              : 'P2P / Udhar'}
          </button>
        ))}
      </div>

      {/* Records List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <IndianRupee className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No financial records found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tap 'Add Record' above to track your first bill or loan.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const remaining = item.amount - item.paid_amount;
            const progress = Math.min(100, (item.paid_amount / item.amount) * 100);
            const isOverdue = new Date(item.due_date) < new Date() && item.status !== 'paid';

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      item.status === 'paid'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : isOverdue
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                    }`}>
                      {item.status === 'paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                    {item.category && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Due: {new Date(item.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {item.contact_name && <span>Party: <strong>{item.contact_name}</strong></span>}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-xs space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                      <span>Paid: ₹{item.paid_amount.toLocaleString('en-IN')}</span>
                      <span>Total: ₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {item.upi_id && item.status !== 'paid' && (
                    <a
                      href={generateUpiUrl({
                        upiId: item.upi_id,
                        name: item.contact_name || item.title,
                        amount: remaining,
                        note: item.title,
                      })}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Pay UPI</span>
                    </a>
                  )}

                  {item.status !== 'paid' && (
                    <button
                      onClick={() => {
                        setPayModalRecord(item);
                        setPayAmount(String(remaining));
                      }}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      Record Pay
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Financial Record</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., MSEB Electricity Bill, Car EMI"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FinancialType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="bill">Bill / Utility</option>
                    <option value="obligation">EMI / Loan Due</option>
                    <option value="p2p_loan">P2P Udhar (Given)</option>
                    <option value="payable">Business Payable</option>
                    <option value="receivable">Business Receivable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Electricity, Rent, WiFi"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Party / Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Bhai"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="name@okaxis"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Payment</h3>
            <p className="text-xs text-slate-500">Record a payment made towards <strong>{payModalRecord.title}</strong></p>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount Paid (₹) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="cash">Cash</option>
                  <option value="netbanking">Net Banking / NEFT</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalRecord(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
