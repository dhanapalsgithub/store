import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, Save, Minus, PackagePlus, X, Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, CATEGORIES, catBadge, errMsg } from "@/lib/api";

const emptyForm = { 
  category: "Attai", 
  productName: "", 
  productNameEn: "", 
  rate: "",         // Retail Price
  wholesaleRate: "", // Wholesale Price
  costRate: "",     // Purchase Price
  stockQty: "", 
  unit: "1 kg", 
  image: "" 
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState("All");
  const [edits, setEdits] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  // States for Search, Low Stock filter, and Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const load = () => {
    setLoading(true);
    api.get("/products")
      .then((r) => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setEdit = (id, field, value) => setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  const bumpStock = (id, delta) => {
    const p = products.find((x) => x.id === id);
    const cur = edits[id]?.stockQty ?? p?.stock ?? p?.Stock ?? 0;
    setEdit(id, "stockQty", Math.max(0, Number(cur) + delta));
  };

  const save = async (id) => {
    const patch = edits[id];
    const originalProduct = products.find((p) => p.id === id);
    if (!patch || !originalProduct) return;

    try {
      const productNameValue = originalProduct.name || originalProduct.products || patch.productName || "Product";
      
      const newRetail = Number(patch.rate !== undefined ? patch.rate : (originalProduct.rate || originalProduct["Retail Price"] || 0));
      const newWholesale = Number(patch.wholesaleRate !== undefined ? patch.wholesaleRate : (originalProduct.wholesaleRate || originalProduct["Wholesale Price"] || 0));
      const newCost = Number(patch.costRate !== undefined ? patch.costRate : (originalProduct.costRate || originalProduct["Purchase Price"] || 0));
      const newStock = Number(patch.stockQty !== undefined ? patch.stockQty : (originalProduct.stockQty !== undefined ? originalProduct.stockQty : (originalProduct.stock || originalProduct["Stock"] || 0)));

      const payload = {
        ...originalProduct,
        ...patch,
        products: productNameValue,
        "Category": patch.category !== undefined ? patch.category : (originalProduct.category || originalProduct["Category"]),
        "Retail Price": newRetail,
        "Wholesale Price": newWholesale,
        "Purchase Price": newCost,
        "Stock": newStock,
        // Backend compatibility keys
        rate: newRetail,
        wholesaleRate: newWholesale,
        costRate: newCost,
        stockQty: newStock
      };
      
      const { data } = await api.put(`/products/${id}`, payload);
      setProducts((ps) => ps.map((p) => (p.id === id ? (data && typeof data === 'object' ? data : payload) : p)));
      setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      toast.success(`${productNameValue} updated & saved to sheet!`);
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
      const productNameValue = form.productName || form.name || "New Product";
      const payload = { 
        ...form, 
        products: productNameValue, 
        productName: productNameValue,
        name: productNameValue,
        "Retail Price": Number(form.rate) || 0,
        "Wholesale Price": Number(form.wholesaleRate) || 0,
        "Purchase Price": Number(form.costRate) || 0,
        "Stock": Number(form.stockQty) || 0,
        rate: Number(form.rate) || 0, 
        wholesaleRate: Number(form.wholesaleRate) || 0,
        costRate: Number(form.costRate) || 0, 
        stockQty: Number(form.stockQty) || 0 
      };
      
      const { data } = await api.post("/products", payload);
      setProducts((ps) => [...ps, data]);
      setShowAdd(false);
      setForm(emptyForm);
      toast.success(`${productNameValue} added successfully!`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return safeProducts.filter((p) => {
      const pCat = p.category || p["Category"] || "";
      const pName = p.name || p.products || "";
      const matchesCat = cat === "All" || pCat === cat;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        (pName && pName.toLowerCase().includes(q)) || 
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (pCat && pCat.toLowerCase().includes(q));

      const currentStock = edits[p.id]?.stockQty ?? p.stock ?? p["Stock"] ?? 0;
      const matchesLowStock = !onlyLowStock || Number(currentStock) < 10;

      return matchesCat && matchesSearch && matchesLowStock;
    });
  }, [safeProducts, cat, searchQuery, onlyLowStock, edits]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const currentProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="space-y-5 fade-up" data-testid="admin-inventory">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rates & Inventory</h2>
          <p className="text-sm text-slate-500">விலை & இருப்பு நிர்வாகம் — manage retail, wholesale & purchase prices</p>
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
          
          <input data-testid="add-product-rate" required type="number" min="0" step="0.01" placeholder="Retail Price ₹" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-wholesale" type="number" min="0" step="0.01" placeholder="Wholesale Price ₹" value={form.wholesaleRate} onChange={(e) => setForm({ ...form, wholesaleRate: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <input data-testid="add-product-cost" type="number" min="0" step="0.01" placeholder="Purchase Price ₹" value={form.costRate} onChange={(e) => setForm({ ...form, costRate: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          
          <input data-testid="add-product-stock" required type="number" min="0" placeholder="Stock Qty" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          
          <button data-testid="add-product-submit" className="col-span-2 sm:col-span-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition active:scale-95">
            <Plus size={14} /> Add Item & Sync to Sheet
          </button>
        </form>
      )}

      {/* Search and Low Stock Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search products by Tamil/English name..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
            data-testid="inventory-search-input"
          />
        </div>
        <button
          onClick={() => { setOnlyLowStock(!onlyLowStock); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap w-full sm:w-auto justify-center ${onlyLowStock ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          data-testid="inventory-low-stock-filter"
        >
          <AlertTriangle size={14} /> Low Stock (&lt;10)
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES.map((c) => c.id)].map((c) => (
          <button key={c} data-testid={`inventory-filter-${c.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => { setCat(c); setCurrentPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition ${cat === c ? "bg-emerald-700 text-white shadow" : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400"}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <PackagePlus size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-products-message">No products found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your category, search, or low-stock filter</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="admin-inventory-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Retail ₹</th>
                    <th className="px-4 py-3">Wholesale ₹</th>
                    <th className="px-4 py-3">Purchase ₹</th>
                    <th className="px-4 py-3">Stock Qty</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProducts.map((p) => {
                    const ed = edits[p.id] || {};
                    const dirty = !!edits[p.id];

                    const pCategory = p.category || p["Category"] || "";
                    const pName = p.name || p.products || "";
                    const pRetail = ed.rate ?? p.rate ?? p["Retail Price"] ?? "";
                    const pWholesale = ed.wholesaleRate ?? p.wholesaleRate ?? p["Wholesale Price"] ?? "";
                    const pCost = ed.costRate ?? p.costRate ?? p["Purchase Price"] ?? "";
                    const currentStock = ed.stockQty ?? p.stock ?? p["Stock"] ?? 0;

                    return (
                      <tr key={p.id} className="border-t border-slate-50 hover:bg-emerald-50/30 transition" data-testid={`inventory-row-${p.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.image && <img src={p.image} alt={p.nameEn || ""} className="w-10 h-10 rounded-lg object-cover bg-slate-100" loading="lazy" />}
                            <div>
                              <p className="font-tamil font-bold text-slate-800 leading-tight">{pName}</p>
                              <p className="text-[11px] text-slate-400">{p.nameEn} • {p.unit}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${catBadge(pCategory)}`}>{pCategory}</span></td>
                        
                        {/* Retail Price Input */}
                        <td className="px-4 py-3">
                          <input data-testid={`rate-input-${p.id}`} type="number" min="0" step="0.01" value={pRetail}
                            onChange={(e) => setEdit(p.id, "rate", e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                        </td>
                        
                        {/* Wholesale Price Input */}
                        <td className="px-4 py-3">
                          <input data-testid={`wholesale-input-${p.id}`} type="number" min="0" step="0.01" value={pWholesale}
                            onChange={(e) => setEdit(p.id, "wholesaleRate", e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                        </td>
                        
                        {/* Purchase Price Input */}
                        <td className="px-4 py-3">
                          <input data-testid={`cost-input-${p.id}`} type="number" min="0" step="0.01" value={pCost}
                            onChange={(e) => setEdit(p.id, "costRate", e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                        </td>

                        {/* Stock Qty Input */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button data-testid={`stock-minus-${p.id}`} onClick={() => bumpStock(p.id, -1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 flex items-center justify-center transition"><Minus size={13} /></button>
                            <input data-testid={`stock-input-${p.id}`} type="number" min="0" value={currentStock}
                              onChange={(e) => setEdit(p.id, "stockQty", e.target.value)}
                              className={`w-16 text-center rounded-lg border px-1 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 ${currentStock < 10 ? "border-red-300 text-red-600 bg-red-50" : "border-slate-200 text-slate-800"}`} />
                            <button data-testid={`stock-plus-${p.id}`} onClick={() => bumpStock(p.id, 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 flex items-center justify-center transition"><Plus size={13} /></button>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button data-testid={`save-product-${p.id}`} onClick={() => save(p.id)} disabled={!dirty}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dirty ? "bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm" : "bg-slate-100 text-slate-300"}`}
                              title="Save to Google Sheet">
                              <Save size={14} />
                            </button>
                            <button data-testid={`delete-product-${p.id}`} onClick={() => remove(p.id)}
                              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition"
                              title="Delete Product">
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
            <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-50 flex items-center justify-between">
              <span>Showing {filtered.length} items • Modify prices/stock and tap save icon to sync with Google Sheet</span>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm mt-4">
              <p className="text-xs text-slate-500">
                Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filtered.length)}</span> of <span className="font-bold">{filtered.length}</span> entries
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