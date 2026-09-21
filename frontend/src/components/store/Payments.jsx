import { useEffect, useState, useMemo } from "react";
import { Receipt, Smartphone, Banknote, ChevronLeft, ChevronRight, Search, Calendar, Download } from "lucide-react";
import api, { fmt } from "@/lib/api";
import { useAuth } from "@/App";

export default function Payments() {
  const { user } = useAuth();
  const [txns, setTxns] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // New states for Search, Calendar Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    api.get("/orders").then((r) => {
      const rawData = r.data || [];
      const list = Array.isArray(rawData) ? rawData : (rawData.data || rawData.orders || rawData.transactions || []);
      
      const formattedList = list
        .map((t, index) => {
          if (!t) return null;

          let orderId = "", customer = "", customerMobile = "", amount = 0, paymentStatus = "Pending", method = "Cash on Delivery", date = "";

          if (Array.isArray(t)) {
            orderId = t[0] || "";
            customerMobile = t[1] || "";
            customer = t[2] || "";
            amount = Number(String(t[4] !== undefined && t[4] !== "" ? t[4] : (t[3] || 0)).replace(/[^0-9.-]+/g, "")) || 0;
            paymentStatus = t[5] || "Pending";
            method = t[6] || "Cash on Delivery";
            date = t[7] || "";
          } else if (typeof t === "object") {
            const keys = Object.keys(t);
            const getVal = (...names) => {
              for (let name of names) {
                const foundKey = keys.find(k => k && k.trim().toLowerCase() === name.toLowerCase());
                if (foundKey && t[foundKey] !== undefined && t[foundKey] !== "") {
                  return t[foundKey];
                }
              }
              return "";
            };

            orderId = getVal("OrderID", "Order ID", "id", "order_id", "orderId");
            customerMobile = getVal("CustomerMobile", "Customer Mobile", "mobile", "phone", "email", "customerMobile");
            customer = getVal("CustomerName", "customerName", "Customer", "Name", "customer_name");
            
            const amountVal = getVal("TotalAmount", "totalAmount", "Paid Amount", "Amount", "amount", "total_amount", "Total Amount");
            amount = Number(String(amountVal).replace(/[^0-9.-]+/g, "")) || 0;
            
            method = getVal("PaymentMethod", "Payment Mode", "Method", "method", "payment_method", "Payment Method") || "Cash on Delivery";
            paymentStatus = getVal("PaymentStatus", "Payment Status", "status", "payment_status", "Status", "paymentStatus") || "Pending";
            date = getVal("Date", "Payment Date", "date", "date_time", "created_at");
          }

          if (!orderId || String(orderId).toLowerCase() === "orderid" || String(orderId).toLowerCase() === "order id") return null;

          const strOrderId = String(orderId || `ORD-${index}`);

          // Check local storage overrides for instant status/payment updates if any
          const localPayment = localStorage.getItem(`order_payment_${strOrderId}`);

          return {
            id: strOrderId,
            customerName: String(customer || "").trim(),
            customerEmail: String(customerMobile || "").toLowerCase().trim(),
            amount: amount,
            method: String(method),
            paymentStatus: String(localPayment || paymentStatus),
            date: date
          };
        })
        .filter((t) => t !== null && t.id);

      // லாகின் செய்துள்ள பயனரின் உண்மையான தகவல்களைப் பயன்படுத்துதல்
      const currentUserName = (user?.name || user?.username || "").toLowerCase().trim();
      const currentUserMobile = (user?.mobile || user?.phone || "").trim();

      const filteredList = formattedList.filter(t => {
        const nameMatch = currentUserName && t.customerName.toLowerCase().includes(currentUserName);
        const mobileMatch = currentUserMobile && t.customerEmail === currentUserMobile;
        return nameMatch || mobileMatch;
      });

      setTxns(filteredList);
    }).catch(() => setTxns([]));
  }, [user]);

  // Filter & Search Logic
  const filteredTxns = useMemo(() => {
    if (!Array.isArray(txns)) return [];
    return txns.filter((t) => {
      const matchesSearch = searchQuery === "" || 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.paymentStatus.toLowerCase().includes(searchQuery.toLowerCase());

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

  // Export to CSV Function
  const exportToCSV = () => {
    if (!filteredTxns.length) return;
    const headers = ["OrderID", "CustomerName", "Amount", "PaymentMethod", "PaymentStatus", "Date"];
    const rows = filteredTxns.map(t => [
      t.id,
      `"${(t.customerName || "").replace(/"/g, '""')}"`,
      t.amount,
      t.method,
      t.paymentStatus,
      t.date ? new Date(t.date).toLocaleString("en-IN") : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `my_payments_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!txns)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  const totalPaid = filteredTxns.reduce((s, t) => s + t.amount, 0);
  const totalPages = Math.ceil(filteredTxns.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTxns = filteredTxns.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-5 fade-up" data-testid="my-payments">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Payment History</h2>
          <p className="text-sm text-slate-500">எனது கட்டண விவரம் — receipts & paid amounts from orders</p>
        </div>
        <div className="flex items-center gap-3">
          {txns.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-xs font-bold transition self-start sm:self-auto"
              data-testid="export-payments-csv"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <div className="bg-emerald-800 text-white rounded-2xl px-5 py-3" data-testid="total-paid-card">
            <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Total Amount</p>
            <p className="text-xl font-extrabold">{fmt(totalPaid)}</p>
          </div>
        </div>
      </div>

      {/* Search and Calendar Filters */}
      {txns.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Order ID, Method, or Status..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
              data-testid="payments-search-input"
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
                data-testid="payments-date-filter"
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
          <p className="text-slate-500 font-semibold" data-testid="no-payments-message">
            {txns.length === 0 ? "No payments yet" : "No matching payments found"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {txns.length === 0 ? "Orders from Google Sheet will appear here" : "Try adjusting your search or date filter"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {currentTxns.map((t, idx) => {
              const formattedDate = t.date && !isNaN(new Date(t.date).getTime())
                ? new Date(t.date).toLocaleString("en-IN")
                : (t.date || "N/A");

              const isPaid = String(t.paymentStatus).toLowerCase() === "paid";

              return (
                <div key={`${t.id}-${idx}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 card-hover" data-testid={`payment-row-${t.id}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${String(t.method).toUpperCase().includes("UPI") ? "bg-blue-50" : "bg-amber-50"}`}>
                    {String(t.method).toUpperCase().includes("UPI") ? <Smartphone size={18} className="text-blue-600" /> : <Banknote size={18} className="text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">Order ID: {t.id}</p>
                    <p className="text-[11px] text-slate-500 font-medium">Customer: {t.customerName} | Method: {t.method}</p>
                    <p className="text-[10px] text-slate-400">Date: {formattedDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-emerald-700">{fmt(t.amount)}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {t.paymentStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
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