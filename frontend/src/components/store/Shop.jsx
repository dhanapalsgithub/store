import { useEffect, useState } from "react";
import { Search, Plus, Minus, Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, catBadge } from "@/lib/api";

const CATEGORIES = [
  { id: "Attai", tamil: "அட்டை", english: "Attai (Flours)" },
  { id: "Saram", tamil: "சரம் பொருட்கள்", english: "Saram (Provisions)" },
  { id: "Loose Pack", tamil: "லூஸ் பேக் பொருட்கள்", english: "Loose Pack" },
];

function ProductCard({ p, cartItem, addToCart, setQty, wished, onWish }) {
  const pId = String(p.ProductsID || p.id || p.products || Math.random());
  
  const stockVal = Number(p.Stock ?? p.stock ?? 0);
  const out = stockVal <= 0;
  const productName = p.products || p.name || "";
  const productRate = p["Retail Price"] || p.rate || p.price || 0;
  const productUnit = p.Unit || p.unit || "";
  const categoryName = p.Category || p.category || "General";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-hover fade-up" data-testid={`product-card-${pId}`}>
      <div className="relative h-40 bg-slate-100">
        <img src={p.image || "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80"} alt={productName} className="w-full h-full object-cover" loading="lazy" />
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full border ${catBadge(categoryName)}`}>{categoryName}</span>
        <button data-testid={`wishlist-toggle-${pId}`} onClick={onWish}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow transition active:scale-90 ${wished ? "bg-red-500 text-white" : "bg-white/90 text-slate-400 hover:text-red-500"}`}>
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </button>
        {out && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span></div>}
      </div>
      <div className="p-4">
        <p className="font-tamil text-base font-bold text-emerald-950 leading-tight" data-testid={`product-name-${pId}`}>{productName}</p>
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{p.nameEn || ""}</p>
        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-lg font-extrabold text-emerald-700">{fmt(productRate)}</p>
            <p className="text-[11px] text-slate-400">per {productUnit} {stockVal > 0 ? `• ${stockVal} left` : ""}</p>
          </div>
          {!out && (
            cartItem ? (
              <div className="flex items-center gap-1 bg-emerald-700 rounded-xl p-1">
                <button data-testid={`qty-minus-${pId}`} onClick={() => setQty(pId, cartItem.qty - 1, p)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"><Minus size={13} /></button>
                <span className="w-7 text-center text-white font-extrabold text-sm" data-testid={`qty-value-${pId}`}>{cartItem.qty}</span>
                <button data-testid={`qty-plus-${pId}`} onClick={() => setQty(pId, cartItem.qty + 1, p)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"><Plus size={13} /></button>
              </div>
            ) : (
              <button data-testid={`add-to-cart-${pId}`} onClick={() => addToCart({ ...p, id: pId })}
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

export default function Shop({ cart = {}, addToCart, setQty, wishlistIds = [], setWishlistIds }) {
  const [products, setProducts] = useState(null);
  const [cat, setCat] = useState("Attai");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/products")
      .then((r) => {
        const d = r.data;
        if (Array.isArray(d)) setProducts(d);
        else if (d && Array.isArray(d.data)) setProducts(d.data);
        else setProducts([]);
      })
      .catch(() => setProducts([]));
  }, []);

  const activeCat = CATEGORIES.find((c) => c.id === cat);
  const safeProducts = Array.isArray(products) ? products : [];
  
  // மேம்படுத்தப்பட்ட கேட்டகிரி மற்றும் தேடல் ஃபில்டர் லாஜிக் (தமிழ் மற்றும் ஆங்கிலம் இரண்டையும் ஒப்பிடும்)
  const filtered = safeProducts.filter((p) => {
    const itemCat = String(p.Category || p.category || "").trim().toLowerCase();
    const targetCat = String(cat || "").trim().toLowerCase();
    const activeCatObj = CATEGORIES.find(c => c.id === cat);
    
    const matchesCategory = 
      itemCat === targetCat || 
      itemCat.includes(targetCat) || 
      targetCat.includes(itemCat) ||
      (activeCatObj && (itemCat.includes(activeCatObj.tamil.toLowerCase()) || activeCatObj.tamil.toLowerCase().includes(itemCat)));
    
    const productName = String(p.products || p.name || "");
    const matchesQuery = !query || productName.toLowerCase().includes(query.toLowerCase());

    return matchesCategory && matchesQuery;
  });

  const handleWishlistToggle = async (pId, p) => {
    const isWished = wishlistIds.includes(pId);
    
    if (isWished) {
      setWishlistIds((ids) => ids.filter((id) => id !== pId));
    } else {
      setWishlistIds((ids) => [...ids, pId]);
    }

    try {
      if (isWished) {
        await api.delete(`/wishlist/${pId}`);
        toast.info("Removed from wishlist");
      } else {
        await api.post("/wishlist", { 
          row: { ProductsID: pId, products: p.products || p.name } 
        });
        toast.success("Added to wishlist");
      }
    } catch (err) {
      if (isWished) {
        setWishlistIds((ids) => [...ids, pId]);
      } else {
        setWishlistIds((ids) => ids.filter((id) => id !== pId));
      }
      toast.error("Failed to update wishlist");
    }
  };

  return (
    <div className="space-y-5" data-testid="shop-section">
      <div className="bg-emerald-800 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-extrabold">வணக்கம்! Fresh stock arrived</h2>
        <div className="mt-4 flex items-center bg-white rounded-xl overflow-hidden max-w-md">
          <span className="pl-4 text-slate-400"><Search size={16} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..." className="w-full px-3 py-3 text-sm text-slate-800 focus:outline-none" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold transition ${
              cat === c.id ? "bg-emerald-700 text-white" : "bg-white text-slate-600 border"
            }`}>
            {c.tamil}
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
        <div className="text-center py-14">
          <p className="text-slate-500 font-semibold text-sm">No products match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((p, idx) => {
            const pId = String(p.ProductsID || p.id || p.products || `prod-${idx}`);
            return (
              <ProductCard
                key={pId}
                p={{ ...p, id: pId }}
                cartItem={cart[pId]}
                addToCart={addToCart}
                setQty={setQty}
                wished={wishlistIds.includes(pId)}
                onWish={() => handleWishlistToggle(pId, p)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}