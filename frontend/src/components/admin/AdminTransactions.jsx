import { useEffect, useState, useMemo } from "react";
import { Receipt, Search, Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";
import api, { fmt } from "@/lib/api";

export default function AdminTransactions() {
  const [txns, setTxns] = useState(null);
  
  // States for Search, Calendar Filter, Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    // Fetching from Orders API endpoint
    api.get("/orders")
      .then((r) => {
        const rawData = r.data || [];
        const list = Array.isArray(rawData) ? rawData : (rawData.data || rawData.orders || []);
        
        const formattedList = list.map((o, idx) => {
          if (!o) return null;

          let orderId = "", customer = "", amount = 0, method = "UPI", date = "";

          if (typeof o === "object") {
            const values = Object.values(o);
            const keys = Object.keys(o);
            
            const findVal = (arr) => {
              for (let a of arr) {
                const found = keys.find(k => k && k.trim().toLowerCase() === a.toLowerCase());
                if (found !== undefined && o[found] !== null && o[found] !== "") return o[found];
              }
              return "";
            };

            orderId = findVal(["Order ID", "OrderID", "order_id", "orderId", "id"]);
            customer = findVal(["customerName", "CustomerName", "Customer", "customer", "Name", "Customer Mobile", "mobile"]);
            const amountRaw = findVal(["Paid Amount", "Total Amount", "Amount", "amount", "paid_amount", "total"]);
            amount = Number(String(amountRaw).replace(/[^0-9.-]+/g, "")) || 0;
            method = findVal(["Payment Mode", "PaymentMethod", "Method", "method", "payment_mode"]) || "UPI";
            date = findVal(["Payment Date", "Date", "date", "payment_date", "createdAt", "orderDate"]);

            if (!orderId && values.length > 0) orderId = values[0];
            if (!customer && values.length > 1) customer = values[1];
            if (amount === 0 && values.length > 3) amount = Number(String(values[3]).replace(/[^0-9.-]+/g, "")) || 0;
          }

          if (!orderId || String(orderId).toLowerCase() === "order id" || String(orderId).toLowerCase() === "order") {
            return null;
          }

          return {
            id: `TXN-${idx + 1}`,
            orderId: String(orderId),
            customerMobile: String(customer || "N/A"),
            method: String(method || "UPI"),
            date: date || new Date().toISOString(),
            amount: amount
          };
        }).filter(t => t !== null && t.orderId && t.amount > 0); // Only include orders with valid amounts as transactions

        setTxns(formattedList);
      })
      .catch(() => setTxns([]));
  }, []);

  // Filter & Search Logic
  const filteredTxns = useMemo(() => {
    if (!Array.isArray(txns)) return [];
    return txns.filter((t) => {
      const matchesSearch = searchQuery === "" || 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerMobile.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.method.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesDate = true;
      if (selectedDate && t.date) {
        const txnDateStr = new Date(t.date).toISOString().split("T")[0];
        matchesDate = txnDateStr === selectedDate;
      } else if (selectedDate && !t.date) {
        matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [txns, searchQuery, selectedDate]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredTxns.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const currentTxns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTxns.slice(start, start + itemsPerPage);
  }, [filteredTxns, currentPage, itemsPerPage]);

  // Export to CSV Function
  const exportToCSV = () => {
    if (!filteredTxns.length) return;
    const headers = ["TransactionID", "OrderID", "Customer", "Method", "Date", "Amount"];
    const rows = filteredTxns.map(t => [
      t.id,
      t.orderId,
      `"${(t.customerMobile || "").replace(/"/g, '""')}"`,
      t.method,
      t.date ? new Date(t.date).toLocaleString("en-IN") : "",
      t.amount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!txns)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  const safeTxns = Array.isArray(txns) ? txns : [];
  const totalCollected = filteredTxns.reduce((s, t) => s + t.amount, 0);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="space-y-5 fade-up" data-testid="admin-transactions">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Transactions</h2>
          <p className="text-sm text-slate-500">பணப் பரிவர்த்தனைகள் — fetched from Orders sheet</p>
        </div>
        <div className="flex items-center gap-3">
          {safeTxns.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-xs font-bold transition self-start sm:self-auto"
              data-testid="export-transactions-csv"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <div className="bg-emerald-800 text-white rounded-2xl px-5 py-3" data-testid="total-collected-card">
            <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Total Collected</p>
            <p className="text-xl font-extrabold">{fmt(totalCollected)}</p>
          </div>
        </div>
      </div>

      {/* Search and Calendar Filters */}
      {safeTxns.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Transaction ID, Order ID, Customer, or Method..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
              data-testid="transactions-search-input"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-auto pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50 text-slate-600 font-medium"
                data-testid="transactions-date-filter"
              />
            </div>
            {selectedDate && (
              <button 
                onClick={() => { setSelectedDate(""); setCurrentPage(1); }}
                className="text-xs text-red-600 hover:underline px-2 py-1 font-semibold whitespace-nowrap"
              >
                Clear Date
              </button>
            )}
          </div>
        </div>
      )}

      {filteredTxns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Receipt size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-transactions-message">
            {safeTxns.length === 0 ? "No transactions from orders yet" : "No matching transactions found"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {safeTxns.length === 0 ? "Transactions from orders will appear here" : "Try adjusting your search or date filter"}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]" data-testid="transactions-table">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTxns.map((t, idx) => (
                    <tr key={`${t.id}-${idx}`} className="border-t border-slate-50 hover:bg-emerald-50/30" data-testid={`txn-row-${t.id}`}>
                      <td className="px-4 py-3 font-bold text-slate-800">{t.id}</td>
                      <td className="px-4 py-3 text-slate-500">{t.orderId}</td>
                      <td className="px-4 py-3 text-slate-600">{t.customerMobile}</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{t.method}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{t.date && !isNaN(new Date(t.date).getTime()) ? new Date(t.date).toLocaleString("en-IN") : t.date}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{fmt(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm mt-4">
              <p className="text-xs text-slate-500">
                Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredTxns.length)}</span> of <span className="font-bold">{filteredTxns.length}</span> entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 flex items-center gap-1 transition"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs font-bold text-slate-700 px-2">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 flex items-center gap-1 transition"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}