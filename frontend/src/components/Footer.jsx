export default function Footer() {
  return (
    <footer className="bg-emerald-900 text-emerald-100 mt-10" data-testid="app-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <p className="font-extrabold text-sm">3 Star Grocery Store</p>
          <p className="font-tamil text-[11px] text-emerald-300">3 ஸ்டார் மளிகை கடை</p>
        </div>
        <p className="text-xs text-emerald-200">© {new Date().getFullYear()} 3 Star Grocery Store. All rights reserved.</p>
        <p className="text-xs font-bold text-amber-300" data-testid="footer-credit">Made by RI Billing Pro</p>
      </div>
    </footer>
  );
}
