import { useEffect, useState, useCallback } from "react";
import { ShoppingBag, ClipboardList, Heart, Receipt, UserCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Shop from "@/components/store/Shop";
import CartDrawer from "@/components/store/CartDrawer";
import MyOrders from "@/components/store/MyOrders";
import Wishlist from "@/components/store/Wishlist";
import Payments from "@/components/store/Payments";
import Account from "@/components/store/Account";

const TABS = [
  { id: "shop", label: "Shop", icon: <ShoppingBag size={14} /> },
  { id: "orders", label: "My Orders", icon: <ClipboardList size={14} /> },
  { id: "wishlist", label: "Wishlist", icon: <Heart size={14} /> },
  { id: "payments", label: "Payments", icon: <Receipt size={14} /> },
  { id: "account", label: "My Account", icon: <UserCircle size={14} /> },
];

export default function Store() {
  const [tab, setTab] = useState("shop");
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sps_cart")) || {}; } catch { return {}; }
  });
  const [wishlistIds, setWishlistIds] = useState([]);

  useEffect(() => {
    localStorage.setItem("sps_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((product, qty = 1) => {
    setCart((c) => {
      const cur = c[product.id]?.qty || 0;
      const next = Math.min(cur + qty, product.stock);
      return { ...c, [product.id]: { product, qty: next } };
    });
  }, []);

  const setQty = useCallback((id, qty, product) => {
    setCart((c) => {
      if (qty <= 0) {
        const n = { ...c };
        delete n[id];
        return n;
      }
      return { ...c, [id]: { product: product || c[id]?.product, qty } };
    });
  }, []);

  const cartCount = Object.values(cart).reduce((s, i) => s + i.qty, 0);

  return (
    <div className="min-h-screen bg-[#fdfbf7]" data-testid="store-dashboard">
      <Header tabs={TABS} active={tab} onTab={setTab} cartCount={cartCount} onCart={() => setCartOpen(true)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28">
        {tab === "shop" && <Shop cart={cart} addToCart={addToCart} setQty={setQty} wishlistIds={wishlistIds} setWishlistIds={setWishlistIds} />}
        {tab === "orders" && <MyOrders />}
        {tab === "wishlist" && <Wishlist addToCart={addToCart} openCart={() => setCartOpen(true)} wishlistIds={wishlistIds} setWishlistIds={setWishlistIds} />}
        {tab === "payments" && <Payments />}
        {tab === "account" && <Account />}
      </main>

      {cartCount > 0 && !cartOpen && (
        <button data-testid="floating-cart-button" onClick={() => setCartOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-2 font-bold text-sm transition active:scale-95 fade-up">
          <ShoppingBag size={17} /> View Cart ({cartCount})
        </button>
      )}

      {cartOpen && (
        <CartDrawer cart={cart} setQty={setQty} onClose={() => setCartOpen(false)}
          onPlaced={() => { setCart({}); setCartOpen(false); setTab("orders"); }} />
      )}
      <Footer />
    </div>
  );
}
