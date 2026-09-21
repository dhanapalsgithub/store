import { useEffect, useState, useMemo } from "react";
import { ClipboardList, CheckCircle2, Truck, Clock, MessageCircle, Search, Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";
import api, { fmt, statusBadge, waOrderLink } from "@/lib/api";
import { useAuth } from "@/App";

const STEPS = ["Pending", "Shipped", "Delivered"];

function Stepper({ status }) {
  const currentStatus = (status || "").trim();
  const idx = currentStatus === "Cancelled" ? -1 : STEPS.indexOf(currentStatus);
  
  return (
    <div className="flex items-center gap-1 mt-3" data-testid="order-stepper">
      {STEPS.map((s, i) => {
        const isActive = idx !== -1 && i <= idx;
        const isLineActive = idx !== -1 && i < idx;
        return (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-300"}`}>
              {s === "Pending" ? <Clock size={12} /> : s === "Shipped" ? <Truck size={12} /> : <CheckCircle2 size={12} />}
            </div>
            <span className={`text-[10px] font-bold ${isActive ? "text-emerald-700" : "text-slate-300"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${isLineActive ? "bg-emerald-500" : "bg-slate-100"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);

  // States for Search, Calendar Filter, Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    api.get("/orders?sheet=Orders")
      .then((r) => {
        const rawData = r.data;
        let list = [];
        if (Array.isArray(rawData)) {
          list = rawData;
        } else if (rawData && Array.isArray(rawData.data)) {
          list = rawData.data;
        }

        // லாகின் செய்த பயனர் விவரங்களை எடுத்தல்
        const currentUserName = (user?.name || user?.username || "").toLowerCase().trim();
        const currentUserMobile = (user?.mobile || user?.phone || "").trim();

        // தற்போதைய பயனரின் ஆர்டர்களை மட்டும் ஃபில்டர் செய்தல்
        const userOrdersList = list.filter((o) => {
          if (!o) return false;
          const customerName = String(o.CustomerName || o.customerName || "").toLowerCase().trim();
          const customerMobile = String(o.CustomerMobile || o.customerMobile || "").trim();

          if (currentUserName && customerName.includes(currentUserName)) return true;
          if (currentUserMobile && customerMobile === currentUserMobile) return true;
          return false;
        });

        const formattedOrders = userOrdersList.map((o) => {
          let parsedItems = [];
          try {
            parsedItems = typeof o.ItemsJSON === "string" ? JSON.parse(o.ItemsJSON) : (o.items || []);
          } catch (e) {
            parsedItems = [];
          }

          const orderId = String(o.OrderID || o.id || "");
          
          // Check local storage overrides for instant admin updates reflection
          const localStatus = localStorage.getItem(`order_status_${orderId}`);
          const localPayment = localStorage.getItem(`order_payment_${orderId}`);

          return {
            id: orderId,
            date: o.Date || o.date,
            status: localStatus || o.Status || o.status || "Pending",
            total: Number(o.TotalAmount || o.total || 0),
            paymentStatus: localPayment || o.PaymentStatus || o.paymentStatus || "Pending",
            paymentMethod: o.PaymentMethod || o.paymentMethod || "Cash on Delivery",
            address: o.Address || o.address || "",
            items: parsedItems
          };
        });

        setOrders(formattedOrders);
      })
      .catch(() => setOrders([]));
  }, [user]);

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter((o) => {
      const matchesSearch = searchQuery === "" || 
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.items || []).some(item => (item.name || item.products || "").toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesDate = true;
      if (selectedDate && o.date) {
        const orderDateStr = new Date(o.date).toISOString().split("T")[0];
        matchesDate = orderDateStr === selectedDate;
      } else if (selectedDate && !o.date) {
        matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [orders, searchQuery, selectedDate]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  
  // Safe check if currentPage exceeds totalPages after filtering
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Export to CSV Function
  const exportToCSV = () => {
    if (!filteredOrders.length) return;
    const headers = ["OrderID", "Date", "Status", "TotalAmount", "PaymentStatus", "PaymentMethod", "Address"];
    const rows = filteredOrders.map(o => [
      o.id,
      o.date ? new Date(o.date).toLocaleString("en-IN") : "",
      o.status,
      o.total,
      o.paymentStatus,
      o.paymentMethod,
      `"${(o.address || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `my_orders_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!orders)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  const safeOrders = Array.isArray(orders) ? orders : [];

  return (
    <div className="space-y-5 fade-up" data-testid="my-orders">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Orders</h2>
          <p className="text-sm text-slate-500">எனது ஆர்டர்கள் — track current & past orders</p>
        </div>
        {safeOrders.length > 0 && (
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition self-start sm:self-auto"
            data-testid="export-orders-csv"
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Search and Calendar Filters */}
      {safeOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Order ID, Status, or Item Name..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
              data-testid="orders-search-input"
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
                data-testid="orders-date-filter"
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

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-orders-message">
            {safeOrders.length === 0 ? "No orders yet" : "No matching orders found"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {safeOrders.length === 0 ? "Add items to your cart and place your first order" : "Try adjusting your search or date filter"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginatedOrders.map((o, orderIndex) => {
              const orderId = String(o.id || `order-${orderIndex}`);
              const orderTotal = Number(o.total || 0);

              return (
                <div key={orderId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover" data-testid={`order-card-${orderId}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-extrabold text-slate-900">{orderId}</p>
                      <p className="text-[11px] text-slate-400">{o.date ? new Date(o.date).toLocaleString("en-IN") : ""}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`} data-testid={`my-order-status-${orderId}`}>{o.status || "Pending"}</span>
                      <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmt(orderTotal)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                    {(o.items || []).map((it, itemIndex) => {
                      const itemName = it.name || it.products || "Item";
                      const itemQty = Number(it.qty || 1);
                      const itemRate = Number(it.rate || it.price || 0);
                      const uniqueItemKey = `${orderId}-item-${itemIndex}-${itemName}`;

                      return (
                        <div key={uniqueItemKey} className="flex justify-between text-xs">
                          <span className="font-tamil font-semibold text-slate-700">{itemName} <span className="text-slate-400">× {itemQty}</span></span>
                          <span className="font-bold text-slate-800">{fmt(itemRate * itemQty)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${o.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`} data-testid={`my-order-payment-${orderId}`}>
                      {o.paymentStatus || "Pending"}{o.paymentMethod ? ` • ${o.paymentMethod}` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {o.address && <span className="text-[11px] text-slate-400 truncate max-w-[38%]">{o.address}</span>}
                      <a data-testid={`order-whatsapp-${orderId}`} href={waOrderLink(o, user)} target="_blank" rel="noreferrer"
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1">
                        <MessageCircle size={11} /> WhatsApp
                      </a>
                    </div>
                  </div>
                  <Stepper status={o.status} />
                  <p className="text-[11px] font-semibold text-slate-500 mt-2" data-testid={`order-tracking-note-${orderId}`}>
                    {o.status === "Delivered" ? "Delivered — நன்றி! Thank you for shopping with us."
                      : o.status === "Shipped" ? "Your order is on the way — out for delivery."
                      : o.status === "Cancelled" ? "This order was cancelled. Contact store for help."
                      : "Order received — packing in progress at the store."}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mt-4">
              <p className="text-xs text-slate-500 font-medium">
                Showing page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span> (Total: {filteredOrders.length} orders)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition flex items-center gap-1"
                  data-testid="pagination-prev"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs font-bold text-slate-800 px-2">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition flex items-center gap-1"
                  data-testid="pagination-next"
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