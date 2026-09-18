import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, Truck, Clock, MessageCircle } from "lucide-react";
import api, { fmt, statusBadge, waOrderLink } from "@/lib/api";
import { useAuth } from "@/App";

const STEPS = ["Pending", "Shipped", "Delivered"];

function Stepper({ status }) {
  const idx = status === "Cancelled" ? -1 : STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-3" data-testid="order-stepper">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i <= idx ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-300"}`}>
            {s === "Pending" ? <Clock size={12} /> : s === "Shipped" ? <Truck size={12} /> : <CheckCircle2 size={12} />}
          </div>
          <span className={`text-[10px] font-bold ${i <= idx ? "text-emerald-700" : "text-slate-300"}`}>{s}</span>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i < idx ? "bg-emerald-500" : "bg-slate-100"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get("/orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, []);

  if (!orders)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 fade-up" data-testid="my-orders">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Orders</h2>
        <p className="text-sm text-slate-500">எனது ஆர்டர்கள் — track current & past orders</p>
      </div>
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-orders-message">No orders yet</p>
          <p className="text-xs text-slate-400 mt-1">Add items to your cart and place your first order</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover" data-testid={`order-card-${o.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-extrabold text-slate-900">{o.id}</p>
                  <p className="text-[11px] text-slate-400">{new Date(o.date).toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`} data-testid={`my-order-status-${o.id}`}>{o.status}</span>
                  <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmt(o.total)}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-tamil font-semibold text-slate-700">{it.name} <span className="text-slate-400">× {it.qty}</span></span>
                    <span className="font-bold text-slate-800">{fmt(it.rate * it.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${o.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`} data-testid={`my-order-payment-${o.id}`}>
                  {o.paymentStatus}{o.paymentMethod ? ` • ${o.paymentMethod}` : ""}
                </span>
                <div className="flex items-center gap-2">
                  {o.address && <span className="text-[11px] text-slate-400 truncate max-w-[38%]">{o.address}</span>}
                  <a data-testid={`order-whatsapp-${o.id}`} href={waOrderLink(o, user)} target="_blank" rel="noreferrer"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1">
                    <MessageCircle size={11} /> WhatsApp
                  </a>
                </div>
              </div>
              <Stepper status={o.status} />
              <p className="text-[11px] font-semibold text-slate-500 mt-2" data-testid={`order-tracking-note-${o.id}`}>
                {o.status === "Delivered" ? "Delivered — நன்றி! Thank you for shopping with us."
                  : o.status === "Shipped" ? "Your order is on the way — out for delivery."
                  : o.status === "Cancelled" ? "This order was cancelled. Contact store for help."
                  : "Order received — packing in progress at the store."}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
