import React, { useState, useEffect } from 'react';
import { Receipt, Plus, ArrowDownLeft, DollarSign } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import {
  getErpInvoices,
  createErpInvoice,
  getGlEntries,
  getErpPayments,
  recordErpPayment,
  getErpExpenses,
  recordErpExpense,
} from '../services/erpAccountingService';
import { getErpParties } from '../services/erpCrmService';
import { ErpInvoice, GLEntry, ErpParty, ErpPayment, ErpExpense } from '../types/enterprise';
import { useToast } from '../context/ToastContext';

export const ErpAccountingPage: React.FC = () => {
  const { currentOrg, selectedProject, selectedSite } = useEnterprise();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<ErpInvoice[]>([]);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [parties, setParties] = useState<ErpParty[]>([]);
  const [payments, setPayments] = useState<ErpPayment[]>([]);
  const [expenses, setExpenses] = useState<ErpExpense[]>([]);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'expenses' | 'ledger'>('invoices');

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Invoice Form state
  const [invType, setInvType] = useState<'purchase' | 'sales'>('purchase');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [invNumber, setInvNumber] = useState('');

  // Payment Form state
  const [paymentType, setPaymentType] = useState<'payment' | 'receipt'>('payment');
  const [payPartyId, setPayPartyId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'bank_transfer' | 'upi' | 'cheque' | 'cash'>('bank_transfer');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  // Expense Form state
  const [expCategory, setExpCategory] = useState('Fuel & Machinery');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expNotes, setExpNotes] = useState('');

  const loadData = async () => {
    if (!currentOrg) return;
    const inv = await getErpInvoices(undefined, selectedProject ? selectedProject.id : null, currentOrg.id);
    setInvoices(inv);
    const gl = await getGlEntries(selectedProject ? selectedProject.id : null, currentOrg.id);
    setGlEntries(gl);
    const pty = await getErpParties(undefined, currentOrg.id);
    setParties(pty);
    const pay = await getErpPayments(currentOrg.id, selectedProject ? selectedProject.id : null);
    setPayments(pay);
    const exp = await getErpExpenses(currentOrg.id, selectedProject ? selectedProject.id : null, selectedSite ? selectedSite.id : null);
    setExpenses(exp);
  };

  useEffect(() => {
    loadData();
  }, [currentOrg, selectedProject, selectedSite]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !amount || !partyId) return;

    const pty = parties.find((p) => p.id === partyId);

    await createErpInvoice({
      org_id: currentOrg.id,
      project_id: selectedProject ? selectedProject.id : 'proj_metro_line_3',
      site_id: selectedSite ? selectedSite.id : 'site_mumbai_cst',
      type: invType,
      invoice_number: invNumber.trim() || ('INV-' + Date.now().toString().slice(-6)),
      invoice_date: new Date().toISOString().split('T')[0],
      party_id: partyId,
      party_name: pty?.legal_name,
      total_amount: parseFloat(amount),
      tax_amount: parseFloat(amount) * 0.18,
      status: 'unpaid',
      items: [{ item_name: 'Project Materials / Services', qty: 1, rate: parseFloat(amount), amount: parseFloat(amount) }],
    });

    showToast('Invoice created & posted to General Ledger', 'success');
    setIsInvoiceModalOpen(false);
    setAmount('');
    setInvNumber('');
    loadData();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !payAmount) return;

    const pty = parties.find((p) => p.id === payPartyId);

    await recordErpPayment({
      org_id: currentOrg.id,
      project_id: selectedProject ? selectedProject.id : null,
      site_id: selectedSite ? selectedSite.id : null,
      payment_type: paymentType,
      payment_number: (paymentType === 'receipt' ? 'REC-' : 'PAY-') + Date.now().toString().slice(-6),
      party_id: payPartyId || null,
      party_name: pty?.legal_name,
      invoice_id: selectedInvoiceId || null,
      amount: parseFloat(payAmount),
      payment_date: new Date().toISOString().split('T')[0],
      mode: payMode as any,
      reference_number: 'UTR-' + Math.floor(100000 + Math.random() * 900000),
    });

    showToast(`${paymentType === 'receipt' ? 'Receipt' : 'Payment'} recorded & posted to GL`, 'success');
    setIsPaymentModalOpen(false);
    setPayAmount('');
    setSelectedInvoiceId('');
    loadData();
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !expAmount || !expPaidTo) return;

    await recordErpExpense({
      org_id: currentOrg.id,
      project_id: selectedProject ? selectedProject.id : 'proj_metro_line_3',
      site_id: selectedSite ? selectedSite.id : 'site_mumbai_cst',
      expense_number: 'EXP-' + Date.now().toString().slice(-6),
      category: expCategory,
      amount: parseFloat(expAmount),
      payment_mode: 'upi',
      paid_to: expPaidTo,
      date: new Date().toISOString().split('T')[0],
      notes: expNotes || null,
      status: 'paid',
    });

    showToast('Site expense logged & posted to General Ledger', 'success');
    setIsExpenseModalOpen(false);
    setExpAmount('');
    setExpPaidTo('');
    setExpNotes('');
    loadData();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            <span>Accounts, Invoicing & General Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete double-entry accounting book with automated GL postings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Record Payment / Receipt</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" />
            <span>Site Expense</span>
          </button>
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Tax Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'payments'
              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Payments & Receipts ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Site Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          General Ledger ({glEntries.length})
        </button>
      </div>

      {/* Tab: Tax Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Total (INR)</th>
                  <th className="p-3">Paid (INR)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          inv.type === 'sales'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {inv.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{inv.invoice_number}</td>
                    <td className="p-3 text-slate-500">{inv.invoice_date}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200 font-bold">{inv.party_name || 'Commercial Party'}</td>
                    <td className="p-3 font-mono font-bold">₹{inv.total_amount.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-mono text-emerald-600">₹{(inv.paid_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : inv.status === 'partially_paid'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Payments & Receipts */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Amount (INR)</th>
                  <th className="p-3">Ref / UTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          p.payment_type === 'receipt'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}
                      >
                        {p.payment_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{p.payment_number}</td>
                    <td className="p-3 text-slate-500">{p.payment_date}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{p.party_name || '-'}</td>
                    <td className="p-3 uppercase text-slate-600 dark:text-slate-400 font-semibold">{p.mode}</td>
                    <td className={`p-3 font-mono font-bold ${p.payment_type === 'receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">{p.reference_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Site Expenses */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Expense #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Paid To</th>
                  <th className="p-3">Amount (INR)</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{exp.expense_number}</td>
                    <td className="p-3 text-slate-500">{exp.date}</td>
                    <td className="p-3 font-bold text-amber-600 dark:text-amber-400">{exp.category}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200 font-semibold">{exp.paid_to}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td className="p-3 uppercase text-slate-500 text-[11px]">{exp.payment_mode}</td>
                    <td className="p-3 text-slate-500 text-[11px]">{exp.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: General Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-sans font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Posting Date</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Account Title</th>
                  <th className="p-3 text-right">Debit (INR)</th>
                  <th className="p-3 text-right">Credit (INR)</th>
                  <th className="p-3 font-sans">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {glEntries.map((gl) => (
                  <tr key={gl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500">{gl.posting_date}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{gl.voucher_number}</td>
                    <td className="p-3 font-sans font-bold text-slate-800 dark:text-slate-200">{gl.account_name}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">{gl.debit > 0 ? `₹${gl.debit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="p-3 text-right text-rose-600 font-bold">{gl.credit > 0 ? `₹${gl.credit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="p-3 font-sans text-slate-500 text-[11px]">{gl.narration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Tax Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInvType('purchase')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      invType === 'purchase'
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Purchase Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvType('sales')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      invType === 'sales'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Sales Invoice
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Commercial Party *</label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="">Select party...</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legal_name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice Number</label>
                <input
                  type="text"
                  placeholder="Auto or INV-2026-XXXX"
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
                >
                  Post Invoice to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment / Receipt Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Payment / Receipt</h3>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Voucher Nature</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('payment')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      paymentType === 'payment'
                        ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Payment Out (Vendor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('receipt')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      paymentType === 'receipt'
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Receipt In (Customer)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Party</label>
                <select
                  value={payPartyId}
                  onChange={(e) => setPayPartyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="">Select party...</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link to Invoice (Optional)</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="">None / On Account</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - ₹{inv.total_amount} ({inv.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="bank_transfer">NEFT / RTGS</option>
                    <option value="upi">UPI / QR</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  Record & Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Site Expense</h3>
            <form onSubmit={handleRecordExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="Fuel & Machinery Diesel">Fuel & Machinery Diesel</option>
                  <option value="Equipment Rental">Equipment Rental</option>
                  <option value="Site Refreshments & Water">Site Refreshments & Water</option>
                  <option value="Repair & Maintenance">Repair & Maintenance</option>
                  <option value="Safety & Consumables">Safety & Consumables</option>
                  <option value="Transport & Cartage">Transport & Cartage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paid To / Recipient *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indian Oil Petrol Pump / Driver"
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. 50L diesel for Generator 2"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ErpAccountingPage;
