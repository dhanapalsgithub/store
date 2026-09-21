import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Plus, CreditCard, Calendar, ChevronLeft, ChevronRight, Loader2, ArrowUpRight } from 'lucide-react';
import api, { errMsg } from "@/lib/api";

export default function PartyPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State for Adding New Party Payment (Supplier Name removed)
  const [formData, setFormData] = useState({
    purchaseNo: '',
    totalAmount: '',
    paidAmount: '',
    paymentMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
  });

  // Fetch Party Payments from Backend API
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/partypayments');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      
      const formatted = data.map((item) => {
        const total = Number(item.totalAmount || item["Total Amount"] || 0);
        const paid = Number(item.paidAmount || item["Paid Amount"] || 0);
        return {
          purchaseNo: item.purchaseNo || item["Purchase No"] || '',
          totalAmount: total,
          paidAmount: paid,
          balance: Number(item.balance || item["Balance"] || (total - paid)),
          paymentMode: item.paymentMode || item["Payment Mode"] || 'Cash',
          date: item.date || item["Date"] || '',
        };
      });

      setPayments(formatted);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Calculate overall stats
  const stats = useMemo(() => {
    const totalPaid = payments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const totalBalance = payments.reduce((sum, item) => sum + Number(item.balance || 0), 0);
    return { totalPaid, totalBalance };
  }, [payments]);

  // Filter payments based on search and date
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      const matchSearch =
        String(item.purchaseNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.paymentMode || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchDate = selectedDate ? item.date === selectedDate : true;

      return matchSearch && matchDate;
    });
  }, [payments, searchQuery, selectedDate]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDate]);

  // Paginated Payments
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage) || 1;

  // Handle Form Input Changes & Auto-calculate Balance
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Add New Party Payment Record
  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const totalAmount = Number(formData.totalAmount) || 0;
      const paidAmount = Number(formData.paidAmount) || 0;
      const balance = totalAmount - paidAmount;

      const payload = {
        purchaseNo: formData.purchaseNo,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balance: balance,
        paymentMode: formData.paymentMode,
        date: formData.date,
      };

      await api.post('/partypayments', payload);
      await fetchPayments();
      
      setShowAddModal(false);
      setCurrentPage(1);
      setFormData({
        purchaseNo: '',
        totalAmount: '',
        paidAmount: '',
        paymentMode: 'Cash',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      alert("Failed to save party payment: " + errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'Purchase No,Total Amount,Paid Amount,Balance,Payment Mode,Date\n';
    const rows = filteredPayments
      .map(
        (p) =>
          `"${p.purchaseNo}",${p.totalAmount},${p.paidAmount},${p.balance},"${p.paymentMode}","${p.date}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PartyPayments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] p-6 text-slate-800">
      {/* Page Title & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#064e3b]">Party Payments</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            விருந்தினர் கொடுப்பனவுகள் — synced with PartyPayments sheet
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] font-semibold border border-emerald-200 px-4 py-2.5 rounded-2xl text-sm transition-all"
          >
            <Download size={16} /> Export CSV
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#064e3b] hover:bg-[#043e2f] text-white font-semibold px-5 py-2.5 rounded-2xl text-sm transition-all shadow-md"
          >
            <Plus size={18} /> Add Payment
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-[#064e3b] text-white px-5 py-2.5 rounded-2xl flex flex-col items-end shadow-sm">
              <span className="text-[10px] font-bold tracking-wider uppercase opacity-85">Total Paid</span>
              <span className="text-lg font-extrabold">₹{stats.totalPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-amber-600 text-white px-5 py-2.5 rounded-2xl flex flex-col items-end shadow-sm">
              <span className="text-[10px] font-bold tracking-wider uppercase opacity-85">Total Balance</span>
              <span className="text-lg font-extrabold">₹{stats.totalBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Purchase No or Payment Mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-11 pr-4 py-2.5 text-sm outline-none focus:border-[#064e3b] transition-all"
          />
        </div>

        <div className="relative w-full md:w-56">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#064e3b] text-slate-600"
          />
        </div>
      </div>

      {/* Party Payments Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[11px] tracking-wider bg-slate-50/50">
                <th className="py-4 px-6">Purchase No</th>
                <th className="py-4 px-4 text-right">Total Amount</th>
                <th className="py-4 px-4 text-right">Paid Amount</th>
                <th className="py-4 px-4 text-right">Balance</th>
                <th className="py-4 px-4 text-center">Payment Mode</th>
                <th className="py-4 px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-16 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-[#064e3b]" size={22} />
                      <span className="font-medium text-sm">Loading party payments from sheet...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPayments.length > 0 ? (
                paginatedPayments.map((p, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors font-medium text-slate-700">
                    <td className="py-4 px-6 font-extrabold text-[#064e3b]">{p.purchaseNo}</td>
                    <td className="py-4 px-4 text-right font-semibold">₹{Number(p.totalAmount).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 text-right text-emerald-700 font-semibold">₹{Number(p.paidAmount).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${Number(p.balance) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        ₹{Number(p.balance).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                        {p.paymentMode}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right text-slate-500 whitespace-nowrap">{p.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    No party payment records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 gap-4 bg-white">
          <span className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-700">{filteredPayments.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredPayments.length)}</span> of <span className="font-bold text-slate-700">{filteredPayments.length}</span> entries
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <div className="flex items-center gap-1 px-2">
              <span className="text-xs font-bold text-[#064e3b]">{currentPage}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-medium text-slate-600">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Add New Party Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-[#064e3b]">Add Party Payment</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Purchase No</label>
                <input
                  type="text"
                  name="purchaseNo"
                  required
                  value={formData.purchaseNo}
                  onChange={handleInputChange}
                  placeholder="e.g. 161618"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Total Amount</label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  placeholder="e.g. 5000"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Paid Amount</label>
                <input
                  type="number"
                  name="paidAmount"
                  required
                  value={formData.paidAmount}
                  onChange={handleInputChange}
                  placeholder="e.g. 3000"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Payment Mode</label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleInputChange}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div className="md:col-span-2 bg-emerald-50 p-4 rounded-2xl flex items-center justify-between mt-2">
                <span className="text-sm font-semibold text-emerald-900">Calculated Balance Due:</span>
                <span className="text-xl font-extrabold text-[#064e3b]">
                  ₹{Math.max(0, (Number(formData.totalAmount || 0) - Number(formData.paidAmount || 0))).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#064e3b] text-white font-semibold text-sm hover:bg-[#043e2f] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}