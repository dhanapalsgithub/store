import { useEffect, useState } from "react";
import { Search, Plus, Minus, Heart, ShoppingCart, Mic } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, CATEGORIES, catBadge } from "@/lib/api";
import VoiceOrder from "@/components/store/VoiceOrder";

function ProductCard({ p, cartItem, addToCart, setQty, wished, onWish }) {
  const out = p.stock <= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-hover fade-up" data-testid={`product-card-${p.id}`}>
      <div className="relative h-40 bg-slate-100">
        <img src={p.image} alt={p.nameEn} className="w-full h-full object-cover" loading="lazy" />
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full border ${catBadge(p.category)}`}>{p.category}</span>
        <button data-testid={`wishlist-toggle-${p.id}`} onClick={onWish}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow transition active:scale-90 ${wished ? "bg-red-500 text-white" : "bg-white/90 text-slate-400 hover:text-red-500"}`}>
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </button>
        {out && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span></div>}
      </div>
      <div className="p-4">
        <p className="font-tamil text-base font-bold text-emerald-950 leading-tight" data-testid={`product-name-${p.id}`}>{p.name}</p>
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{p.nameEn}</p>
        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-lg font-extrabold text-emerald-700">{fmt(p.rate)}</p>
            <p className="text-[11px] text-slate-400">per {p.unit} • {p.stock} left</p>
          </div>
          {!out && (
            cartItem ? (
              <div className="flex items-center gap-1 bg-emerald-700 rounded-xl p-1">
                <button data-testid={`qty-minus-${p.id}`} onClick={() => setQty(p.id, cartItem.qty - 1, p)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"><Minus size={13} /></button>
                <span className="w-7 text-center text-white font-extrabold text-sm" data-testid={`qty-value-${p.id}`}>{cartItem.qty}</span>
                <button data-testid={`qty-plus-${p.id}`} onClick={() => setQty(p.id, Math.min(cartItem.qty + 1, p.stock), p)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"><Plus size={13} /></button>
              </div>
            ) : (
              <button data-testid={`add-to-cart-${p.id}`} onClick={() => addToCart(p)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 transition active:scale-95">
                <ShoppingCart size={13} /> Add
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function Shop({ cart, addToCart, setQty, wishlistIds, setWishlistIds, onOrderPlaced }) {
  const [products, setProducts] = useState(null);
  const [cat, setCat] = useState("Attai");
  const [query, setQuery] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => setProducts([]));
    api.get("/wishlist").then((r) => setWishlistIds(r.data.map((p) => p.id))).catch(() => {});
  }, [setWishlistIds]);

  const toggleWish = async (p) => {
    const wished = wishlistIds.includes(p.id);
    setWishlistIds((ids) => (wished ? ids.filter((i) => i !== p.id) : [...ids, p.id]));
    try {
      if (wished) {
        await api.delete(`/wishlist/${p.id}`);
        toast.info(`${p.name} removed from wishlist`);
      } else {
        await api.post("/wishlist", { productId: p.id });
        toast.success(`${p.name} saved to wishlist`);
      }
    } catch {
      setWishlistIds((ids) => (wished ? [...ids, p.id] : ids.filter((i) => i !== p.id)));
    }
  };

  const activeCat = CATEGORIES.find((c) => c.id === cat);
  const filtered = (products || []).filter(
    (p) => p.category === cat && (p.name.includes(query) || p.nameEn.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-5" data-testid="shop-section">
      <div className="bg-emerald-800 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 85% 20%, #fbbf24 0, transparent 45%)" }} />
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">வணக்கம்! Fresh stock arrived</h2>
          <p className="text-emerald-100/80 text-sm mt-1">Daily fair rates on flours, provisions & loose pack items</p>
          <div className="mt-4 flex items-center gap-2 max-w-md">
            <div className="flex items-center bg-white rounded-xl overflow-hidden flex-1">
              <span className="pl-4 text-slate-400"><Search size={16} /></span>
              <input data-testid="product-search-input" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products… (e.g. மாவு, rice, oil)"
                className="w-full px-3 py-3 text-sm text-slate-800 focus:outline-none" />
            </div>
            <button data-testid="voice-order-button" onClick={() => setVoiceOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-xl px-4 py-3 text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 shrink-0">
              <Mic size={15} /> Voice
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" data-testid="category-tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} data-testid={`category-tab-${c.id.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setCat(c.id)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full text-xs font-bold transition ${
              cat === c.id ? "bg-emerald-700 text-white shadow-lg shadow-emerald-700/25" : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400"
            }`}>
            <span className="font-tamil">{c.tamil}</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900">{activeCat?.english}</h3>
        <p className="text-xs text-slate-400">{filtered.length} items available</p>
      </div>

      {!products ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-14 text-sm" data-testid="no-products-message">No products match your search</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} cartItem={cart[p.id]} addToCart={addToCart} setQty={setQty}
              wished={wishlistIds.includes(p.id)} onWish={() => toggleWish(p)} />
          ))}
        </div>
      )}

      {voiceOpen && (
        <VoiceOrder products={products || []} onClose={() => setVoiceOpen(false)}
          onPlaced={() => { setVoiceOpen(false); onOrderPlaced?.(); }} />
      )}
    </div>
  );
}
