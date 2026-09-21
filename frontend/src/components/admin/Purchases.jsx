import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Plus, ShoppingBag, Calendar, FileText, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api, { errMsg }  from "@/lib/api";

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State for Adding New Purchase
  const [formData, setFormData] = useState({
    purchaseNo: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplierName: '',
    invoiceNo: '',
    itemName: '',
    qty: '',
    pRate: '',
    salesRate: '',
    mrp: '',
  });

  // Fetch Purchases from Google Sheets via Backend API
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/purchases');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      
      // Map sheet headers or raw object keys to match UI expectations cleanly
      const formatted = data.map((item) => ({
        purchaseNo: item.purchaseNo || item.eNo || '',
        purchaseDate: item.purchaseDate || '',
        supplierName: item.supplierName || '',
        invoiceNo: item.invoiceNo || '',
        itemName: item["item.name"] || item.itemName || '',
        qty: Number(item["item.qty"] || item.qty || 0),
        pRate: Number(item["item.pRate"] || item.pRate || 0),
        salesRate: Number(item["item.salesRate"] || item.salesRate || 0),
        mrp: Number(item["item.mrp"] || item.mrp || 0),
        total: Number(item["item.total"] || item.total || 0),
      }));

      setPurchases(formatted);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  // Calculate stats
  const totalPurchaseValue = useMemo(() => {
    return purchases.reduce((sum, item) => sum + Number(item.total || 0), 0);
  }, [purchases]);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      const matchSearch =
        String(item.purchaseNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchDate = selectedDate ? item.purchaseDate === selectedDate : true;

      return matchSearch && matchDate;
    });
  }, [purchases, searchQuery, selectedDate]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDate]);

  // Paginated Purchases
  const paginatedPurchases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPurchases.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPurchases, currentPage]);

  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage) || 1;

  // Handle Form Change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Add New Purchase Record (Saves to Google Sheet)
  const handleAddPurchase = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const qty = Number(formData.qty) || 0;
      const pRate = Number(formData.pRate) || 0;
      
      const payload = {
        purchaseNo: formData.purchaseNo,
        purchaseDate: formData.purchaseDate,
        supplierName: formData.supplierName,
        invoiceNo: formData.invoiceNo,
        itemName: formData.itemName,
        qty: qty,
        pRate: pRate,
        salesRate: Number(formData.salesRate) || 0,
        mrp: Number(formData.mrp) || 0,
        total: qty * pRate,
      };

      await api.post('/purchases', payload);
      
      // Refresh list directly from backend to sync state
      await fetchPurchases();
      
      setShowAddModal(false);
      setCurrentPage(1);
      setFormData({
        purchaseNo: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        supplierName: '',
        invoiceNo: '',
        itemName: '',
        qty: '',
        pRate: '',
        salesRate: '',
        mrp: '',
      });
    } catch (err) {
      alert("Failed to save purchase: " + errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'Purchase No,Purchase Date,Supplier Name,Invoice No,Item Name,Qty,Purchase Rate,Sales Rate,MRP,Total\n';
    const rows = filteredPurchases
      .map(
        (p) =>
          `"${p.purchaseNo}","${p.purchaseDate}","${p.supplierName}","${p.invoiceNo}","${p.itemName}",${p.qty},${p.pRate},${p.salesRate},${p.mrp},${p.total}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Purchases_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] p-6 text-slate-800">
      {/* Page Title & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#064e3b]">Purchases</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            கொள்முதல் பதிவுகள் — synced with Purchases sheet
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
            <Plus size={18} /> Add Purchase
          </button>

          <div className="bg-[#064e3b] text-white px-6 py-3 rounded-2xl flex flex-col items-end shadow-sm">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">Total Outflow</span>
            <span className="text-xl font-extrabold">₹{totalPurchaseValue.toLocaleString('en-IN')}</span>
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
            placeholder="Search by Purchase No, Supplier, Item or Invoice..."
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

      {/* Purchases Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[11px] tracking-wider bg-slate-50/50">
                <th className="py-4 px-6">Purchase No</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Supplier</th>
                <th className="py-4 px-4">Invoice No</th>
                <th className="py-4 px-4">Item Name</th>
                <th className="py-4 px-4 text-center">Qty</th>
                <th className="py-4 px-4 text-right">P. Rate</th>
                <th className="py-4 px-4 text-right">Sales Rate</th>
                <th className="py-4 px-4 text-right">MRP</th>
                <th className="py-4 px-6 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-16 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-[#064e3b]" size={22} />
                      <span className="font-medium text-sm">Loading purchases from sheet...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPurchases.length > 0 ? (
                paginatedPurchases.map((p, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors font-medium text-slate-700">
                    <td className="py-4 px-6 font-extrabold text-[#064e3b]">{p.purchaseNo}</td>
                    <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{p.purchaseDate}</td>
                    <td className="py-4 px-4 font-semibold text-slate-800 capitalize">{p.supplierName}</td>
                    <td className="py-4 px-4 text-slate-500">{p.invoiceNo || '-'}</td>
                    <td className="py-4 px-4 font-semibold">{p.itemName}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">
                        {p.qty}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">₹{p.pRate}</td>
                    <td className="py-4 px-4 text-right text-emerald-700 font-semibold">₹{p.salesRate}</td>
                    <td className="py-4 px-4 text-right text-slate-400 line-through text-xs">₹{p.mrp}</td>
                    <td className="py-4 px-6 text-right font-extrabold text-[#064e3b] text-base">
                      ₹{Number(p.total).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-400">
                    No purchase records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 gap-4 bg-white">
          <span className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-700">{filteredPurchases.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredPurchases.length)}</span> of <span className="font-bold text-slate-700">{filteredPurchases.length}</span> entries
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

      {/* Add New Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-[#064e3b]">Add New Purchase Record</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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
                <label className="text-xs font-bold text-slate-500 uppercase">Purchase Date</label>
                <input
                  type="date"
                  name="purchaseDate"
                  required
                  value={formData.purchaseDate}
                  onChange={handleInputChange}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Supplier Name</label>
                <input
                  type="text"
                  name="supplierName"
                  required
                  value={formData.supplierName}
                  onChange={handleInputChange}
                  placeholder="e.g. Joe Traders"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Invoice No</label>
                <input
                  type="text"
                  name="invoiceNo"
                  value={formData.invoiceNo}
                  onChange={handleInputChange}
                  placeholder="e.g. INV-2026"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Item Name</label>
                <input
                  type="text"
                  name="itemName"
                  required
                  value={formData.itemName}
                  onChange={handleInputChange}
                  placeholder="e.g. Pepper bold size-மிளகு"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Quantity</label>
                <input
                  type="number"
                  name="qty"
                  required
                  value={formData.qty}
                  onChange={handleInputChange}
                  placeholder="200"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Purchase Rate (P.Rate)</label>
                <input
                  type="number"
                  name="pRate"
                  required
                  value={formData.pRate}
                  onChange={handleInputChange}
                  placeholder="150"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Sales Rate</label>
                <input
                  type="number"
                  name="salesRate"
                  value={formData.salesRate}
                  onChange={handleInputChange}
                  placeholder="170"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">MRP</label>
                <input
                  type="number"
                  name="mrp"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  placeholder="180"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#064e3b]"
                />
              </div>

              <div className="md:col-span-2 bg-emerald-50 p-4 rounded-2xl flex items-center justify-between mt-2">
                <span className="text-sm font-semibold text-emerald-900">Calculated Total Outflow:</span>
                <span className="text-xl font-extrabold text-[#064e3b]">
                  ₹{(Number(formData.qty || 0) * Number(formData.pRate || 0)).toLocaleString('en-IN')}
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
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}