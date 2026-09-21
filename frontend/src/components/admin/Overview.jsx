import { useEffect, useState } from "react";
import { IndianRupee, TrendingUp, ReceiptText, ShoppingBag, AlertTriangle, Wallet, PackageX } from "lucide-react";
import api, { fmt } from "@/lib/api";

function Stat({ icon, label, value, sub, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${tone}`}>{icon}</div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);

  // Fetch updated analytics summary combining products (retail vs purchase price) and orders (revenue & collected/paid amounts)
  useEffect(() => {
    api.get("/analytics/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data)
    return (
      <div className="flex justify-center py-20" data-testid="analytics-loading">
        <div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const statusCounts = data.statusCounts || {};
  const lowStock = data.lowStock || [];
  const recentOrders = data.recentOrders || [];

  return (
    <div className="space-y-6 fade-up" data-testid="admin-analytics">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Business Summary</h2>
        <p className="text-sm text-slate-500">வணிக சுருக்கம் — net profit (retail vs purchase), revenue & collected bills</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue calculated strictly from Order Sheet total amounts */}
        <Stat 
          icon={<IndianRupee size={18} className="text-emerald-700" />} 
          label="Total Revenue" 
          value={fmt(data.totalRevenue)} 
          sub={`${data.totalBills || 0} bills (Order Sheet)`} 
          tone="bg-emerald-50" 
        />
        
        {/* Net Profit calculated based on Product Sheet Retail Rate vs Purchase Price margins */}
        <Stat 
          icon={<TrendingUp size={18} className="text-amber-600" />} 
          label="Net Profit" 
          value={fmt(data.netProfit)} 
          sub="Retail vs Purchase margin" 
          tone="bg-amber-50" 
        />

        {/* Collected & Pending Amounts derived from Order Sheet paid status */}
        <Stat 
          icon={<Wallet size={18} className="text-blue-600" />} 
          label="Collected Amount" 
          value={fmt(data.collected)} 
          sub={`${fmt(data.pendingAmount)} pending`} 
          tone="bg-blue-50" 
        />

        {/* Average Bill Value across Daily & Monthly Reports */}
        <Stat 
          icon={<ReceiptText size={18} className="text-purple-600" />} 
          label="Avg Bill Value" 
          value={fmt(data.avgOrderValue)} 
          sub="Per order cycle" 
          tone="bg-purple-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5" data-testid="order-status-summary">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ShoppingBag size={16} className="text-emerald-700" /> Order Pipeline</h3>
          {["Pending", "Shipped", "Delivered"].map((s) => (
            <div key={s} className="flex items-center justify-between py-2.5 border-b border-dashed border-slate-100 last:border-0">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s === "Delivered" ? "bg-emerald-100 text-emerald-700" : s === "Shipped" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{s}</span>
              <span className="text-lg font-extrabold text-slate-800" data-testid={`status-count-${s.toLowerCase()}`}>{statusCounts[s] || 0}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5" data-testid="low-stock-panel">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Low Stock Alerts</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">All items sufficiently stocked</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-tamil text-sm font-bold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.nameEn} (Purchase: {fmt(p.purchasePrice)} | Retail: {fmt(p.retailRate)})</p>
                  </div>
                  <span className="text-xs font-extrabold text-red-600 flex items-center gap-1"><PackageX size={13} /> {p.stock}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5" data-testid="recent-orders-panel">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ReceiptText size={16} className="text-emerald-700" /> Recent Bills</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No orders yet</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{o.id} — <span className="text-emerald-600 font-semibold">Paid: {fmt(o.paidAmount)}</span></p>
                    <p className="text-[11px] text-slate-500">{o.customerName || o.customerMobile} ({o.date || 'Today'})</p>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900">{fmt(o.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}