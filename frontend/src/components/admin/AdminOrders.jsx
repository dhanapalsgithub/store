import { useEffect, useState, useMemo } from "react";
import { ClipboardList, MapPin, Phone, ChevronLeft, ChevronRight, CheckCircle2, Truck, Clock, Search, Calendar, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, statusBadge } from "@/lib/api";

const STEPS = ["Pending", "Shipped", "Delivered"];

let cachedDevice = null;

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

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  
  // States for Search, Calendar Filter, Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Print Preview Dialog State
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [printerDevice, setPrinterDevice] = useState(null);

  const load = () => {
    api.get("/orders")
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        const synced = list.map(o => {
          const orderId = String(o.OrderID || o.id || "");
          const localOverride = localStorage.getItem(`order_status_${orderId}`);
          const localPayment = localStorage.getItem(`order_payment_${orderId}`);
          
          let parsedItems = [];
          try {
            parsedItems = typeof o.ItemsJSON === "string" ? JSON.parse(o.ItemsJSON) : (o.items || []);
          } catch (e) {
            parsedItems = [];
          }

          return {
            ...o,
            id: orderId,
            status: localOverride || o.Status || o.status || "Pending",
            paymentStatus: localPayment || o.PaymentStatus || o.paymentStatus || "Unpaid",
            items: parsedItems
          };
        });
        setOrders(synced);
      })
      .catch(() => setOrders([]));
  };

  useEffect(() => { load(); }, []);

  const update = async (id, patch) => {
    try {
      await api.put(`/orders/${id}`, patch);
      if (patch.status) localStorage.setItem(`order_status_${id}`, patch.status);
      if (patch.paymentStatus) localStorage.setItem(`order_payment_${id}`, patch.paymentStatus);

      setOrders((os) => (Array.isArray(os) ? os.map((o) => (String(o.id) === String(id) ? { ...o, ...patch } : o)) : []));
      toast.success(`Order ${id} updated`);
    } catch (e) {
      if (patch.status) localStorage.setItem(`order_status_${id}`, patch.status);
      if (patch.paymentStatus) localStorage.setItem(`order_payment_${id}`, patch.paymentStatus);
      
      setOrders((os) => (Array.isArray(os) ? os.map((o) => (String(o.id) === String(id) ? { ...o, ...patch } : o)) : []));
      toast.success(`Order ${id} updated locally`);
    }
  };

  // Image Processing Logic for Thermal Printing
  const getImageBytes = async (url, printWidth = 200) => {
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const canvas = document.createElement('canvas');
      const width = printWidth;
      const height = Math.floor(img.height * (width / img.width));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const { data } = imageData;
      const printData = [];
      printData.push(0x1d, 0x76, 0x30, 0, Math.ceil(width / 8), 0, height % 256, Math.floor(height / 256));
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < Math.ceil(width / 8); x++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const i = ((y * width) + (x * 8) + b) * 4;
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (avg < 128) byte |= (0x80 >> b);
          }
          printData.push(byte);
        }
      }
      return new Uint8Array(printData);
    } catch (e) { return null; }
  };

  const sendLargeData = async (characteristic, data) => {
    const chunkSize = 100;
    const encoder = new TextEncoder();
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      await characteristic.writeValue(chunk);
      await new Promise(r => setTimeout(r, 10));
    }
  };

  // Bluetooth Thermal Print Execution Function
  const handleThermalPrint = async (order) => {
    try {
      const nav = navigator;
      if (!nav.bluetooth) {
        toast.error("Bluetooth Service not available.");
        return;
      }

      let device = cachedDevice;
      if (!device || !device.gatt?.connected) {
        try {
          device = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
          });
          cachedDevice = device;
          setPrinterDevice(device);
        } catch (err) {
          console.log("User cancelled device selection or error occurred.");
          return;
        }
      }

      const server = await device.gatt?.connect();
      const services = await server.getPrimaryServices();
      const char = (await services[0].getCharacteristics()).find((c) =>
        c.properties.write || c.properties.writeWithoutResponse
      );

      if (!char) {
        toast.error("Cannot connect to Printer characteristic.");
        return;
      }

      const enc = new TextEncoder();
      const INIT = '\x1B\x40';
      const CENTER = '\x1B\x61\x01';
      const BOLD_ON = '\x1B\x45\x01';
      const BOLD_OFF = '\x1B\x45\x00';
      const SIZE_BIG = '\x1D\x21\x11';
      const SIZE_NORMAL = '\x1D\x21\x00';

      await char.writeValue(enc.encode(INIT + CENTER));
      await new Promise(r => setTimeout(r, 500));

      const logoBytes = await getImageBytes('/logobf5.png', 120);
      if (logoBytes) {
        await sendLargeData(char, logoBytes);
      }

      const orderDate = order.Date || order.date ? new Date(order.Date || order.date) : new Date();
      const dateStr = orderDate.toLocaleDateString('en-GB');
      const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const orderItems = order.items || [];
      const totalQty = orderItems.reduce((sum, item) => sum + (Number(item.qty || item.quantity) || 0), 0);
      const totalAmount = Number(order.TotalAmount || order.total || 0);
      const paymentMode = order.PaymentMethod || order.paymentMethod || "CASH";

      let billHeader = `\n${SIZE_BIG}${BOLD_ON}3 Star Grocery ${SIZE_NORMAL}${BOLD_OFF}\n` +
        `1/422 Srinivasa Nagar,\nKovur EB, Chennai - 600128\n` +
        `Mob: 9941669513\n--------------------------------\n` +
        `DT: ${dateStr}  TM: ${timeStr}\nBill No: ${order.id}\n` +
        `Customer: ${order.CustomerName || order.customerName || "Customer"}\n` +
        `--------------------------------\n` +
        `${BOLD_ON}  Item               Rate     Qty   Amount${BOLD_OFF}\n` +
        `------------------------------------------\n`;
      await sendLargeData(char, billHeader);

      let itemsData = "";
      const STYLE_NORMAL = '\x1B\x21\x00';

      orderItems.forEach((item, index) => {
        const sno = (index + 1).toString().padEnd(3);
        const unitText = item.unit || item.selectedUnit ? `(${item.unit || item.selectedUnit})` : "";
        const itemName = String(`${item.name || item.products || "Item"} ${unitText}`).substring(0, 10).padEnd(14);
        const rate = parseFloat(String(item.rate || item.price || 0)).toFixed(2).padStart(9);
        const qty = parseFloat(String(item.qty || item.quantity || 0)).toFixed(2).padStart(9);
        const itemTotal = parseFloat(String((item.rate || item.price || 0) * (item.qty || item.quantity || 0))).toFixed(2).padStart(7);

        itemsData += `${STYLE_NORMAL}${sno}${itemName}${rate}${qty}${itemTotal}\n`;
        itemsData += `----------------------------------------------\n`;
      });

      await sendLargeData(char, itemsData);

      let billFooter = `___________________________________________________\n`;
      billFooter += `${BOLD_ON}${"Subtotal:".padEnd(12)}Rs.${Math.round(totalAmount).toString().padStart(10)}${BOLD_OFF}\n`;
      billFooter += `${"Total Qty:".padEnd(12)}${totalQty.toString().padStart(13)}\n`;
      billFooter += `\n${SIZE_BIG}${"NET TOTAL:".padEnd(10)}Rs.${Math.round(totalAmount).toString().padStart(6)}${STYLE_NORMAL}\n`;
      billFooter += `************************************************\n`;
      billFooter += `Payment: ${paymentMode}\n`;

      await sendLargeData(char, billFooter);

      await char.writeValue(new Uint8Array([0x1b, 0x21, 0x01]));
      await char.writeValue(enc.encode(`${CENTER}No Returns, Exchanges, or Refunds. No Warranty for China Items.\n`));
      await char.writeValue(enc.encode(`${CENTER}Goods Sold are Final. Thank You! Visit Again BalaJi Fancy, Kovur.`));
      await char.writeValue(new Uint8Array([0x1b, 0x21, 0x00]));
      await char.writeValue(enc.encode(`\n${CENTER}R I Billing Pro.\n`));

      await new Promise(r => setTimeout(r, 1000));
      await char.writeValue(enc.encode('\n'));

      const CUT_PAPER = '\n\n\x1D\x56\x42\x00';
      try {
        await char.writeValue(enc.encode(CUT_PAPER));
      } catch (e) {
        console.error("Cut failed", e);
      }

      toast.success(`Order ${order.id} printed successfully!`);
      setSelectedOrderForPrint(null);
    } catch (error) {
      toast.error("Bluetooth Print Error: " + error.message);
    }
  };

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter((o) => {
      const customerName = String(o.CustomerName || o.customerName || "");
      const customerMobile = String(o.CustomerMobile || o.customerMobile || "");
      const status = String(o.Status || o.status || "");

      const matchesSearch = searchQuery === "" || 
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerMobile.toLowerCase().includes(searchQuery.toLowerCase()) ||
        status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.items || []).some(item => (item.name || item.products || "").toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesDate = true;
      const orderDateVal = o.Date || o.date;
      if (selectedDate && orderDateVal) {
        const orderDateStr = new Date(orderDateVal).toISOString().split("T")[0];
        matchesDate = orderDateStr === selectedDate;
      } else if (selectedDate && !orderDateVal) {
        matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [orders, searchQuery, selectedDate]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));

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
    const headers = ["OrderID", "CustomerName", "CustomerMobile", "TotalAmount", "PaymentStatus", "PaymentMethod", "Status", "Address", "Date"];
    const rows = filteredOrders.map(o => [
      o.id,
      `"${(o.CustomerName || o.customerName || "").replace(/"/g, '""')}"`,
      o.CustomerMobile || o.customerMobile || "",
      o.TotalAmount || o.total || 0,
      o.PaymentStatus || o.paymentStatus || "",
      o.PaymentMethod || o.paymentMethod || "",
      o.Status || o.status || "",
      `"${(o.Address || o.address || "").replace(/"/g, '""')}"`,
      (o.Date || o.date) ? new Date(o.Date || o.date).toLocaleString("en-IN") : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_orders_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!orders)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  const safeOrders = Array.isArray(orders) ? orders : [];
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="space-y-5 fade-up" data-testid="admin-orders">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Order Management</h2>
          <p className="text-sm text-slate-500">ஆர்டர் நிர்வாகம் — update delivery, payment status & 80mm thermal printing</p>
        </div>
        {safeOrders.length > 0 && (
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-xs font-bold transition self-start sm:self-auto"
            data-testid="export-admin-orders-csv"
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
              placeholder="Search by Order ID, Customer Name, Mobile, Status, or Item..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
              data-testid="admin-orders-search-input"
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
                data-testid="admin-orders-date-filter"
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
          <p className="text-slate-500 font-semibold" data-testid="no-admin-orders-message">
            {safeOrders.length === 0 ? "No orders yet" : "No matching orders found"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {safeOrders.length === 0 ? "Customer orders will appear here in real time" : "Try adjusting your search or date filter"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {paginatedOrders.map((o) => {
              const oId = String(o.OrderID || o.id || "");
              const oStatus = o.Status || o.status || "Pending";
              const oPaymentStatus = o.PaymentStatus || o.paymentStatus || "Unpaid";

              return (
                <div key={oId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover" data-testid={`admin-order-${oId}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-extrabold text-slate-900" data-testid={`order-id-${oId}`}>{oId}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <Phone size={11} /> {o.CustomerMobile || o.customerMobile} • {o.CustomerName || o.customerName || "Customer"}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5" data-testid={`order-address-${oId}`}>
                        <MapPin size={12} className="text-amber-600 shrink-0" />
                        <span className="font-semibold text-slate-600">{o.Address || o.address || "No address provided"}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-emerald-700">{fmt(Number(o.TotalAmount || o.total || 0))}</p>
                      <p className="text-[11px] text-slate-400">{(o.Date || o.date) ? new Date(o.Date || o.date).toLocaleString("en-IN") : ""}</p>
                    </div>
                  </div>

                  {/* இங்கேயும் யூனிட் மற்றும் அளவு சேர்த்து காட்டும்படி அப்டேட் செய்யப்பட்டுள்ளது */}
                  <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1">
                    {(o.items || []).map((it, i) => {
                      const itemName = it.name || it.products || "Item";
                      const itemQty = Number(it.qty || it.quantity || 1);
                      const itemUnit = it.unit || it.selectedUnit || "";
                      const itemRate = Number(it.rate || it.price || 0);

                      return (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="font-tamil font-semibold text-slate-700">
                            {itemName} 
                            <span className="text-slate-400">
                              {itemUnit ? ` (${itemUnit})` : ""} × {itemQty}
                            </span>
                          </span>
                          <span className="font-bold text-slate-800">{fmt(itemRate * itemQty)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(oStatus)}`} data-testid={`order-status-badge-${oId}`}>{oStatus}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${oPaymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`} data-testid={`order-payment-badge-${oId}`}>
                      {oPaymentStatus} {o.PaymentMethod || o.paymentMethod ? `• ${o.PaymentMethod || o.paymentMethod}` : ""}
                    </span>

                    <button 
                      onClick={() => setSelectedOrderForPrint(o)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition"
                      data-testid={`order-print-btn-${oId}`}
                    >
                      <Printer size={13} /> Print Bill
                    </button>

                    <div className="flex-1" />

                    <select data-testid={`order-status-select-${oId}`} value={oStatus} onChange={(e) => update(oId, { status: e.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white">
                      <option value="Pending">Pending</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>

                    <button data-testid={`order-payment-toggle-${oId}`} onClick={() => update(oId, { paymentStatus: oPaymentStatus === "Paid" ? "Unpaid" : "Paid" })}
                      className={`text-xs font-bold rounded-lg px-3 py-2 transition active:scale-95 ${oPaymentStatus === "Paid" ? "bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>
                      {oPaymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}
                    </button>
                  </div>
                  <Stepper status={oStatus} />
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm mt-4">
              <p className="text-xs text-slate-500">
                Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredOrders.length)}</span> of <span className="font-bold">{filteredOrders.length}</span> entries
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

      {/* Bill Print Preview Modal */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="text-center border-b border-dashed pb-3">
              <h3 className="text-lg font-bold text-slate-900">BALAJI FANCY STORE</h3>
              <p className="text-[11px] text-slate-500">No.1/231, Srinivasa Nagar, Kovur EB, Chennai - 600128</p>
              <p className="text-[11px] font-semibold text-slate-600 mt-1">Bill No: {selectedOrderForPrint.id}</p>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs py-1">
              {(selectedOrderForPrint.items || []).map((it, idx) => {
                const uText = it.unit || it.selectedUnit ? ` (${it.unit || it.selectedUnit})` : "";
                return (
                  <div key={idx} className="flex justify-between">
                    <span>{idx + 1}. {it.name || it.products}{uText} ({it.rate || it.price} × {it.qty || it.quantity})</span>
                    <span className="font-bold">{fmt((it.rate || it.price || 0) * (it.qty || it.quantity || 0))}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed pt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-bold">{(selectedOrderForPrint.items || []).length}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-emerald-700 pt-1">
                <span>Net Total:</span>
                <span>{fmt(Number(selectedOrderForPrint.TotalAmount || selectedOrderForPrint.total || 0))}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleThermalPrint(selectedOrderForPrint)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/20"
              >
                <Printer size={14} /> Print via Bluetooth
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}