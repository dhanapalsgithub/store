import { Store as StoreIcon, LogOut, ShoppingCart } from "lucide-react";
import { useAuth } from "@/App";

export default function Header({ tabs, active, onTab, cartCount, onCart }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-emerald-800 text-white shadow-lg" data-testid="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
              <StoreIcon size={18} className="text-emerald-900" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-sm sm:text-base leading-tight truncate">3 Star Provisional Store</p>
              <p className="font-tamil text-[11px] text-amber-300 leading-tight">3 ஸ்டார் மளிகை கடை</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onCart && (
              <button data-testid="nav-cart-button" onClick={onCart}
                className="relative w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center justify-center">
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span data-testid="nav-cart-count" className="absolute -top-1 -right-1 bg-amber-400 text-emerald-950 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            <div className="hidden sm:block text-right mr-1">
              <p className="text-xs font-bold leading-tight" data-testid="header-user-name">{user?.name}</p>
              <p className="text-[10px] text-emerald-200 uppercase tracking-wider" data-testid="header-user-role">{user?.role}</p>
            </div>
            <button data-testid="logout-button" onClick={logout}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/80 transition flex items-center justify-center" title="Logout">
              <LogOut size={17} />
            </button>
          </div>
        </div>
        {tabs && (
          <nav className="flex gap-1 overflow-x-auto pb-2 -mb-0 scrollbar-none" data-testid="main-nav-tabs">
            {tabs.map((t) => (
              <button key={t.id} data-testid={`nav-tab-${t.id}`} onClick={() => onTab(t.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  active === t.id ? "bg-white text-emerald-800 shadow" : "text-emerald-100 hover:bg-white/10"
                }`}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
