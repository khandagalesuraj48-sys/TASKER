import React, { useState, useEffect } from 'react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getErpInvoices, getGlEntries, getErpExpenses } from '../services/erpAccountingService';
import { getInventoryStock } from '../services/erpInventoryService';
import { ErpInvoice, GLEntry, ErpExpense, InventoryStock } from '../types/enterprise';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Download, Printer } from 'lucide-react';

export const ErpReportsPage: React.FC = () => {
  const { currentOrg, selectedProject, selectedSite } = useEnterprise();
  const [invoices, setInvoices] = useState<ErpInvoice[]>([]);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [expenses, setExpenses] = useState<ErpExpense[]>([]);
  const [stocks, setStocks] = useState<InventoryStock[]>([]);

  useEffect(() => {
    const loadAllData = async () => {
      const [invData, glData, expData, stockData] = await Promise.all([
        getErpInvoices(undefined, selectedProject?.id, currentOrg?.id),
        getGlEntries(selectedProject?.id, currentOrg?.id),
        getErpExpenses(currentOrg?.id, selectedProject?.id, selectedSite?.id),
        getInventoryStock(selectedSite?.id, currentOrg?.id),
      ]);
      setInvoices(invData);
      setGlEntries(glData);
      setExpenses(expData);
      setStocks(stockData);
    };
    loadAllData();
  }, [selectedProject, selectedSite, currentOrg]);

  // Financial Metrics
  const totalSales = invoices
    .filter((inv) => inv.type === 'sales')
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const totalPurchases = invoices
    .filter((inv) => inv.type === 'purchase')
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const totalSiteExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const totalStockValuation = stocks.reduce(
    (sum, st) => sum + st.quantity_on_hand * st.valuation_rate,
    0
  );

  const netOperatingMargin = totalSales - totalPurchases - totalSiteExpenses;

  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Amount (INR)'],
      ['Total Project Sales / Billing', totalSales],
      ['Total Procurement & Purchases', totalPurchases],
      ['Total Site Operations Expenses', totalSiteExpenses],
      ['Closing Inventory Valuation', totalStockValuation],
      ['Net Operating Margin', netOperatingMargin],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Enterprise_P&L_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Executive Financial Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consolidated Profit & Loss, Site Cost Variance, Inventory Valuation & Trial Balance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Gross Billing / Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{totalSales.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">Client Tax Invoices</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Material Procurement</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{totalPurchases.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-rose-600 font-semibold">Vendor Purchase Bills</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Site Operations Cost</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{totalSiteExpenses.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-amber-600 font-semibold">Vouchers & Petty Cash</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Stock Assets on Site</span>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{totalStockValuation.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-indigo-600 font-semibold">Valuation at Standard Cost</span>
        </div>
      </div>

      {/* Profit & Loss Statement Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Profit & Loss Statement (Project: {selectedProject?.name || 'All Active Projects'})
          </h3>
          <span className="text-xs font-mono text-slate-500">FY 2026-27</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>Operating Revenue (Sales Invoices)</span>
              <span>₹{totalSales.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 pl-4">
              <span>Less: Direct Material Procurement</span>
              <span>(₹{totalPurchases.toLocaleString('en-IN')})</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 pl-4">
              <span>Less: Site Operations & Petty Expenses</span>
              <span>(₹{totalSiteExpenses.toLocaleString('en-IN')})</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center font-black text-sm">
            <span className="text-slate-900 dark:text-white">Estimated Operating Contribution</span>
            <span className={netOperatingMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              ₹{netOperatingMargin.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* General Ledger Journal Trail */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Audit General Ledger Journal Entries</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Posting Date</th>
                <th className="p-3">Voucher #</th>
                <th className="p-3">Account Title</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {glEntries.slice(0, 15).map((gl) => (
                <tr key={gl.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-slate-600 dark:text-slate-400">{gl.posting_date}</td>
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{gl.voucher_number}</td>
                  <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-200">{gl.account_name}</td>
                  <td className="p-3 text-right text-emerald-600">{gl.debit > 0 ? `₹${gl.debit.toLocaleString('en-IN')}` : '-'}</td>
                  <td className="p-3 text-right text-rose-600">{gl.credit > 0 ? `₹${gl.credit.toLocaleString('en-IN')}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ErpReportsPage;
