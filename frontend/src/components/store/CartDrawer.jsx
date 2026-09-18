import { useState } from "react";
import { X, Minus, Plus, Trash2, MapPin, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, errMsg } from "@/lib/api";
import { useAuth } from "@/App";

export default function CartDrawer({ cart, setQty, onClose, onPlaced }) {
  const { user } = useAuth();
  const items = Object.values(cart);
  const total = items.reduce((s, i) => s + i.product.rate * i.qty, 0);
  const [payment, setPayment] = useState("Cash on Delivery");
  const [address, setAddress] = useState(user?.address || "");
  const [placing, setPlacing] = useState(false);

  const placeOrder = async () => {
    if (items.length === 0) return;
    if (!address.trim()) {
      toast.error("Please enter your delivery address");
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
        paymentMethod: payment,
        address,
      });
      toast.success(`Order ${data.id} placed! ${payment === "UPI" ? "Payment recorded." : "Pay on delivery."}`);
      onPlaced();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" data-testid="cart-drawer">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#fdfbf7] shadow-2xl drawer-in flex flex-col">
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold">Your Cart</h3>
            <p className="font-tamil text-xs text-amber-300">உங்கள் கூடை • {items.length} items</p>
          </div>
          <button data-testid="cart-close-button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm" data-testid="cart-empty-message">Your cart is empty</p>
          ) : (
            items.map(({ product: p, qty }) => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3" data-testid={`cart-item-${p.id}`}>
                <img src={p.image} alt={p.nameEn} className="w-14 h-14 rounded-xl object-cover bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-tamil text-sm font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400">{fmt(p.rate)} / {p.unit}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <button data-testid={`cart-minus-${p.id}`} onClick={() => setQty(p.id, qty - 1)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-red-100 flex items-center justify-center transition"><Minus size={12} /></button>
                    <span className="w-8 text-center text-sm font-extrabold" data-testid={`cart-qty-${p.id}`}>{qty}</span>
                    <button data-testid={`cart-plus-${p.id}`} onClick={() => setQty(p.id, Math.min(qty + 1, p.stock), p)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-emerald-100 flex items-center justify-center transition"><Plus size={12} /></button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-emerald-700 text-sm">{fmt(p.rate * qty)}</p>
                  <button data-testid={`cart-remove-${p.id}`} onClick={() => setQty(p.id, 0)} className="text-slate-300 hover:text-red-500 mt-1 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-200 bg-white p-4 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><MapPin size={11} /> Delivery Address <span className="text-red-500">*</span></label>
              <textarea data-testid="cart-address-input" value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Delivery address" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: "Cash on Delivery", icon: <Banknote size={15} /> }, { id: "UPI", icon: <Smartphone size={15} /> }].map((m) => (
                <button key={m.id} data-testid={`payment-method-${m.id === "UPI" ? "upi" : "cod"}`} onClick={() => setPayment(m.id)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    payment === m.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}>
                  {m.icon} {m.id === "UPI" ? "UPI (Pay Now)" : "Cash on Delivery"}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Total</p>
                <p className="text-2xl font-extrabold text-emerald-800" data-testid="cart-total">{fmt(total)}</p>
              </div>
              <button data-testid="cart-checkout-button" onClick={placeOrder} disabled={placing}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl px-6 py-3.5 text-sm transition active:scale-95 disabled:opacity-60">
                {placing ? "Placing…" : "Place Order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
