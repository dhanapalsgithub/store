import { useEffect, useState } from "react";
import { ClipboardList, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, statusBadge, errMsg } from "@/lib/api";

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);

  const load = () => api.get("/orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  useEffect(() => { load(); }, []);

  const update = async (id, patch) => {
    try {
      const { data } = await api.put(`/orders/${id}`, patch);
      setOrders((os) => os.map((o) => (o.id === id ? data : o)));
      toast.success(`Order ${id} updated`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!orders)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 fade-up" data-testid="admin-orders">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Order Management</h2>
        <p className="text-sm text-slate-500">ஆர்டர் நிர்வாகம் — update delivery & payment status</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No orders yet</p>
          <p className="text-xs text-slate-400 mt-1">Customer orders will appear here in real time</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover" data-testid={`admin-order-${o.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-extrabold text-slate-900" data-testid={`order-id-${o.id}`}>{o.id}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <Phone size={11} /> {o.customerMobile} • {o.customerName || "Customer"}
                  </p>
                  {o.address && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={11} /> {o.address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-emerald-700">{fmt(o.total)}</p>
                  <p className="text-[11px] text-slate-400">{new Date(o.date).toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-tamil font-semibold text-slate-700">{it.name} <span className="text-slate-400">× {it.qty}</span></span>
                    <span className="font-bold text-slate-800">{fmt(it.rate * it.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`} data-testid={`order-status-badge-${o.id}`}>{o.status}</span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${o.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`} data-testid={`order-payment-badge-${o.id}`}>
                  {o.paymentStatus} {o.paymentMethod ? `• ${o.paymentMethod}` : ""}
                </span>
                <div className="flex-1" />
                <select data-testid={`order-status-select-${o.id}`} value={o.status} onChange={(e) => update(o.id, { status: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white">
                  <option>Pending</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
                  <option>Cancelled</option>
                </select>
                <button data-testid={`order-payment-toggle-${o.id}`} onClick={() => update(o.id, { paymentStatus: o.paymentStatus === "Paid" ? "Unpaid" : "Paid" })}
                  className={`text-xs font-bold rounded-lg px-3 py-2 transition active:scale-95 ${o.paymentStatus === "Paid" ? "bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>
                  {o.paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
