import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Minus, PackagePlus, X } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, CATEGORIES, catBadge, errMsg } from "@/lib/api";

const emptyForm = { category: "Attai", productName: "", productNameEn: "", rate: "", costRate: "", stockQty: "", unit: "1 kg", image: "" };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState("All");
  const [edits, setEdits] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/products").then((r) => setProducts(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setEdit = (id, field, value) => setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  const bumpStock = (id, delta) => {
    const p = products.find((x) => x.id === id);
    const cur = edits[id]?.stockQty ?? p.stock;
    setEdit(id, "stockQty", Math.max(0, Number(cur) + delta));
  };

  const save = async (id) => {
    const patch = edits[id];
    if (!patch) return;
    try {
      const payload = {};
      if (patch.rate !== undefined) payload.rate = Number(patch.rate);
      if (patch.costRate !== undefined) payload.costRate = Number(patch.costRate);
      if (patch.stockQty !== undefined) payload.stockQty = Number(patch.stockQty);
      const { data } = await api.put(`/products/${id}`, payload);
      setProducts((ps) => ps.map((p) => (p.id === id ? data : p)));
      setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      toast.success(`${data.name} updated`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      setProducts((ps) => ps.filter((p) => p.id !== id));
      toast.success("Product removed");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const add = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/products", { ...form, rate: Number(form.rate), costRate: Number(form.costRate) || 0, stockQty: Number(form.stockQty) });
      setProducts((ps) => [...ps, data]);
      setShowAdd(false);
      setForm(emptyForm);
      toast.success(`${data.name} added to inventory`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const filtered = cat === "All" ? products : products.filter((p) => p.category === cat);

  return (
    <div className="space-y-5 fade-up" data-testid="admin-inventory">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rates & Inventory</h2>
          <p className="text-sm text-slate-500">விலை & இருப்பு நிர்வாகம் — edit rates and stock instantly</p>
        </div>
        <button data-testid="add-product-toggle" onClick={() => setShowAdd(!showAdd)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 transition active:scale-95">
          {showAdd ? <X size={14} /> : <PackagePlus size={14} />} {showAdd ? "Close" : "Add Product"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={add} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 fade-up" data-testid="add-product-form">
          <select data-testid="add-product-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
          <input data-testid="add-product-name-ta" required placeholder="தமிழ் பெயர்" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-tamil focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-name-en" placeholder="English name" value={form.productNameEn} onChange={(e) => setForm({ ...form, productNameEn: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-unit" placeholder="Unit (1 kg)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-rate" required type="number" min="0" step="0.01" placeholder="Rate ₹" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-cost" type="number" min="0" step="0.01" placeholder="Cost ₹ (for profit)" value={form.costRate} onChange={(e) => setForm({ ...form, costRate: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-stock" required type="number" min="0" placeholder="Stock Qty" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <button data-testid="add-product-submit" className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition active:scale-95">
            <Plus size={14} /> Add Item
          </button>
        </form>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES.map((c) => c.id)].map((c) => (
          <button key={c} data-testid={`inventory-filter-${c.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setCat(c)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition ${cat === c ? "bg-emerald-700 text-white shadow" : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400"}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="admin-inventory-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Rate ₹</th>
                  <th className="px-4 py-3">Cost ₹</th>
                  <th className="px-4 py-3">Stock Qty</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const ed = edits[p.id] || {};
                  const dirty = !!edits[p.id];
                  return (
                    <tr key={p.id} className="border-t border-slate-50 hover:bg-emerald-50/30 transition" data-testid={`inventory-row-${p.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={p.image} alt={p.nameEn} className="w-10 h-10 rounded-lg object-cover bg-slate-100" loading="lazy" />
                          <div>
                            <p className="font-tamil font-bold text-slate-800 leading-tight">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{p.nameEn} • {p.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${catBadge(p.category)}`}>{p.category}</span></td>
                      <td className="px-4 py-3">
                        <input data-testid={`rate-input-${p.id}`} type="number" min="0" step="0.01" value={ed.rate ?? p.rate}
                          onChange={(e) => setEdit(p.id, "rate", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                      </td>
                      <td className="px-4 py-3">
                        <input data-testid={`cost-input-${p.id}`} type="number" min="0" step="0.01" value={ed.costRate ?? p.costRate}
                          onChange={(e) => setEdit(p.id, "costRate", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button data-testid={`stock-minus-${p.id}`} onClick={() => bumpStock(p.id, -1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 flex items-center justify-center transition"><Minus size={13} /></button>
                          <input data-testid={`stock-input-${p.id}`} type="number" min="0" value={ed.stockQty ?? p.stock}
                            onChange={(e) => setEdit(p.id, "stockQty", e.target.value)}
                            className={`w-16 text-center rounded-lg border px-1 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 ${(ed.stockQty ?? p.stock) < 10 ? "border-red-300 text-red-600 bg-red-50" : "border-slate-200 text-slate-800"}`} />
                          <button data-testid={`stock-plus-${p.id}`} onClick={() => bumpStock(p.id, 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 flex items-center justify-center transition"><Plus size={13} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button data-testid={`save-product-${p.id}`} onClick={() => save(p.id)} disabled={!dirty}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dirty ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-slate-100 text-slate-300"}`}>
                            <Save size={14} />
                          </button>
                          <button data-testid={`delete-product-${p.id}`} onClick={() => remove(p.id)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-50">{filtered.length} items • Edit rate/cost/stock inline, then tap save</p>
        </div>
      )}
    </div>
  );
}
