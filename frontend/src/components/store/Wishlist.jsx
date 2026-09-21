import { useEffect, useState } from "react";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { fmt } from "@/lib/api";

export default function Wishlist({ products = [], wishlistIds = [], setWishlistIds, addToCart, openCart }) {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [masterProducts, setMasterProducts] = useState(products);
  const [loading, setLoading] = useState(true);

  // Ensure we have the master products catalog loaded to read correct retail prices
  useEffect(() => {
    if (products && products.length > 0) {
      setMasterProducts(products);
    } else {
      api.get("/products").then((res) => {
        const list = res.data?.products || res.data || [];
        if (Array.isArray(list)) setMasterProducts(list);
      }).catch(() => {});
    }
  }, [products]);

  useEffect(() => {
    let isMounted = true;
    
    // Get currently logged-in user details to filter their specific wishlist
    const savedUser = localStorage.getItem("sps_user");
    const userObj = savedUser ? JSON.parse(savedUser) : null;
    const currentMobile = String(userObj?.mobile || userObj?.phone || "").trim();

    api.get("/wishlist")
      .then((r) => {
        const rawData = r.data || [];
        const itemsList = Array.isArray(rawData) ? rawData : (rawData.data || []);
        
        if (!isMounted) return;

        // Filter items strictly belonging to the currently logged-in user (if CustomerMobile exists in sheet)
        const userFilteredList = itemsList.filter((item) => {
          const itemMobile = String(item.CustomerMobile || item.mobile || "").trim();
          // If the sheet has CustomerMobile tracked, filter by it. Otherwise fallback to all if single-user mode.
          return !itemMobile || !currentMobile || itemMobile === currentMobile;
        });

        const storedIds = userFilteredList.map((item) => String(item.ProductID || item.productId || item.products || item.id)).filter(Boolean);
        
        if (typeof setWishlistIds === "function") {
          setWishlistIds(storedIds);
        }

        const resolvedItems = userFilteredList.map((wItem) => {
          const wId = String(wItem.ProductID || wItem.productId || wItem.products || wItem.id).trim();
          
          // Match against master products list using multiple possible keys
          const matchedProduct = masterProducts.find((p) => {
            const pId = String(p.ProductsID || p.id || p.products || "").trim();
            const pName = String(p.products || p.name || "").trim();
            return pId === wId || pName === wId || pId.toLowerCase() === wId.toLowerCase();
          });

          if (matchedProduct) {
            return {
              ...matchedProduct,
              id: wId,
              products: matchedProduct.products || matchedProduct.name || wId,
              "Retail Price": Number(matchedProduct["Retail Price"] || matchedProduct.rate || matchedProduct.price || 0),
              Unit: matchedProduct.Unit || matchedProduct.unit || ""
            };
          }

          // Fallback parsing if not in master list
          return {
            id: wId,
            products: wId,
            "Retail Price": Number(wItem["Retail Price"] || wItem.rate || wItem.price || 0),
            Unit: wItem.Unit || wItem.unit || ""
          };
        });

        setWishlistItems(resolvedItems);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setWishlistItems([]);
          setLoading(false);
        }
      });
  }, [masterProducts, setWishlistIds]);

  const remove = async (pId, pName) => {
    try {
      await api.delete(`/wishlist/${pId}`);
      setWishlistItems((list) => list.filter((x) => String(x.id) !== String(pId)));
      if (typeof setWishlistIds === "function") {
        setWishlistIds((ids) => ids.filter((id) => String(id) !== String(pId)));
      }
      toast.info(`${pName || "Product"} removed from wishlist`);
    } catch {
      toast.error("Could not remove from wishlist");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-up" data-testid="my-wishlist">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Wishlist</h2>
        <p className="text-sm text-slate-500">எனது விருப்பப் பட்டியல் — quick re-order of favourites</p>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Heart size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold" data-testid="no-wishlist-message">Wishlist is empty</p>
          <p className="text-xs text-slate-400 mt-1">Tap the heart on any product to save it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {wishlistItems.map((p, idx) => {
            const pId = String(p.id || p.ProductsID || p.products || `wish-${idx}`);
            const productName = p.products || p.name || pId;
            const productRate = Number(p["Retail Price"] || p.rate || p.price || 0);
            const productUnit = p.Unit || p.unit || "";
            const stockVal = Number(p.Stock ?? p.stock ?? 99);

            return (
              <div key={`${pId}-${idx}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between card-hover" data-testid={`wishlist-card-${pId}`}>
                <div>
                  <p className="font-tamil text-base font-bold text-emerald-950 leading-tight">{productName}</p>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-lg font-extrabold text-emerald-700">{fmt(productRate)}</p>
                    {productUnit && <p className="text-[11px] text-slate-400">per {productUnit}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      data-testid={`wishlist-add-cart-${pId}`} 
                      onClick={() => { addToCart({ ...p, id: pId, name: productName, rate: productRate }); openCart(); }} 
                      disabled={stockVal <= 0}
                      className="w-9 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-40">
                      <ShoppingCart size={15} />
                    </button>
                    <button 
                      data-testid={`wishlist-remove-${pId}`} 
                      onClick={() => remove(pId, productName)}
                      className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}