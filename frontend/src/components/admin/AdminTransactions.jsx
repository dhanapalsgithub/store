import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import api, { fmt } from "@/lib/api";

export default function AdminTransactions() {
  const [txns, setTxns] = useState(null);

  useEffect(() => {
    api.get("/transactions").then((r) => setTxns(r.data)).catch(() => setTxns([]));
  }, []);

  if (!txns)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 fade-up" data-testid="admin-transactions">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Transactions</h2>
        <p className="text-sm text-slate-500">பணப் பரிவர்த்தனைகள் — all received payments</p>
      </div>
      {txns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Receipt size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No transactions yet</p>
        </div>
      ) : (
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
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-slate-50 hover:bg-emerald-50/30" data-testid={`txn-row-${t.id}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{t.id}</td>
                    <td className="px-4 py-3 text-slate-500">{t.orderId}</td>
                    <td className="px-4 py-3 text-slate-600">{t.customerMobile}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{t.method}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.date).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
