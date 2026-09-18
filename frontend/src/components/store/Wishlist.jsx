import { useEffect, useState } from "react";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, catBadge } from "@/lib/api";

export default function Wishlist({ addToCart, openCart, wishlistIds, setWishlistIds }) {
  const [items, setItems] = useState(null);

  const load = () =>
    api.get("/wishlist").then((r) => {
      setItems(r.data);
      setWishlistIds(r.data.map((p) => p.id));
    }).catch(() => setItems([]));
  useEffect(() => { load(); }, [setWishlistIds]);

  const remove = async (p) => {
    try {
      await api.delete(`/wishlist/${p.id}`);
      setItems((list) => list.filter((x) => x.id !== p.id));
      setWishlistIds((ids) => ids.filter((i) => i !== p.id));
      toast.info(`${p.name} removed`);
    } catch {
      toast.error("Could not remove");
    }
  };

  if (!items)
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 fade-up" data-testid="my-wishlist">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Wishlist</h2>
        <p className="text-sm text-slate-500">எனது விருப்பப் பட்டியல் — quick re-order of favourites</p>
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Heart size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-wishlist-message">Wishlist is empty</p>
          <p className="text-xs text-slate-400 mt-1">Tap the heart on any product to save it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-hover" data-testid={`wishlist-card-${p.id}`}>
              <div className="relative h-36 bg-slate-100">
                <img src={p.image} alt={p.nameEn} className="w-full h-full object-cover" loading="lazy" />
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full border ${catBadge(p.category)}`}>{p.category}</span>
              </div>
              <div className="p-4">
                <p className="font-tamil text-base font-bold text-emerald-950 leading-tight">{p.name}</p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{p.nameEn}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-extrabold text-emerald-700">{fmt(p.rate)}<span className="text-[10px] text-slate-400 font-medium"> / {p.unit}</span></p>
                  <div className="flex gap-1.5">
                    <button data-testid={`wishlist-add-cart-${p.id}`} onClick={() => { addToCart(p); openCart(); }} disabled={p.stock <= 0}
                      className="w-9 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-40">
                      <ShoppingCart size={15} />
                    </button>
                    <button data-testid={`wishlist-remove-${p.id}`} onClick={() => remove(p)}
                      className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
