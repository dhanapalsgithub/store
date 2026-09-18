import { useEffect, useState } from "react";
import { Receipt, Smartphone, Banknote } from "lucide-react";
import api, { fmt } from "@/lib/api";

export default function Payments() {
  const [txns, setTxns] = useState(null);

  useEffect(() => {
    api.get("/transactions").then((r) => setTxns(r.data)).catch(() => setTxns([]));
  }, []);

  if (!txns)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  const totalPaid = txns.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5 fade-up" data-testid="my-payments">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Payment History</h2>
          <p className="text-sm text-slate-500">எனது கட்டண விவரம் — receipts & paid amounts</p>
        </div>
        <div className="bg-emerald-800 text-white rounded-2xl px-5 py-3" data-testid="total-paid-card">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Total Paid</p>
          <p className="text-xl font-extrabold">{fmt(totalPaid)}</p>
        </div>
      </div>
      {txns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Receipt size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-payments-message">No payments yet</p>
          <p className="text-xs text-slate-400 mt-1">Paid orders will appear here as receipts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {txns.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 card-hover" data-testid={`payment-row-${t.id}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.method === "UPI" ? "bg-blue-50" : "bg-amber-50"}`}>
                {t.method === "UPI" ? <Smartphone size={18} className="text-blue-600" /> : <Banknote size={18} className="text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{t.id}</p>
                <p className="text-[11px] text-slate-400">Order {t.orderId} • {new Date(t.date).toLocaleString("en-IN")}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-emerald-700">{fmt(t.amount)}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PAID • {t.method}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
