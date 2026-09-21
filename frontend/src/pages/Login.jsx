import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store as StoreIcon, Phone, Lock, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { appsScriptRequest, errMsg } from "@/lib/api";
import { useAuth } from "@/App";

// Test IDs for the auth feature (login, register, password reset, logout).
export const LOGIN = {
  emailInput: 'login-email-input',
  passwordInput: 'login-password-input',
  submitButton: 'login-submit-button',
  forgotPasswordLink: 'login-forgot-password-link',
  registerLink: 'login-register-link',
};

export const REGISTER = {
  nameInput: 'register-name-input',
  emailInput: 'register-email-input',
  passwordInput: 'register-password-input',
  passwordConfirmInput: 'register-password-confirm-input',
  submitButton: 'register-submit-button',
  loginLink: 'register-login-link',
};

export const LOGOUT = {
  button: 'logout-button',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        // 1. Apps Script மூலம் பயனர்களின் பட்டியலைப் பெறுதல்
        const res = await appsScriptRequest({
          action: "list",
          sheet: "Users"
        });

        const users = res.data || [];
        const inputId = String(mobile || "").trim().toLowerCase();
        const inputPw = String(password || "").trim();

        // 2. பயனர் மற்றும் பாஸ்வேர்டு சரிபார்த்தல்
        const user = users.find(
          (u) =>
            (String(u.Mobile || "").trim().toLowerCase() === inputId ||
              String(u.Email || "").trim().toLowerCase() === inputId) &&
            String(u.Password || "").trim() === inputPw
        );

        if (user) {
          const rawRole = String(user.Role || user.role || user.UserType || user["User type"] || "").trim().toLowerCase();
          const isOwner = rawRole === "owner" || inputId === "shaludhana1116@gmail.com" || inputId === "9000000001";

          const authData = {
            token: "apps-script-token-" + Date.now(),
            user: {
              name: user.Name || (isOwner ? "Owner" : "Customer"),
              mobile: user.Mobile,
              email: user.Email,
              role: isOwner ? "Owner" : "Customer",
              address: user.Address || ""
            }
          };

          login(authData);
          toast.success(`வணக்கம், ${authData.user.name}!`);

          // Owner ஆக இருந்தால் /admin-க்குச் செல்லும், மற்றவர்கள் /store-க்குச் செல்வார்கள்
          navigate(isOwner ? "/admin" : "/store", { replace: true });
        } else {
          setError("தவறான மொபைல் எண்/மின்னஞ்சல் அல்லது கடவுச்சொல்!");
        }
      } else {
        // 3. Register Logic (புதிய கணக்கை உருவாக்குதல்)
        if (!name.trim()) {
          setError("தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.");
          setLoading(false);
          return;
        }
        if (!mobile.trim()) {
          setError("தயவுசெய்து மொபைல் எண்ணை உள்ளிடவும்.");
          setLoading(false);
          return;
        }

        const payload = {
          action: "register", // "create" என்பதற்குப் பதிலாக "register"
          sheet: "Users",
          data: {
            Name: name.trim(),
            Mobile: mobile.trim(),
            Email: email.trim(),
            Password: password.trim(),
            Address: address.trim(),
            Role: "Customer"
          }
        };

        const res = await appsScriptRequest(payload);

        if (res && (res.ok !== false)) {
          toast.success("கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!");

          // பதிவு செய்தவுடன் ஆட்டோமேட்டிக்காக லாகின் செய்து கொள்ளுதல்
          const authData = {
            token: "apps-script-token-" + Date.now(),
            user: {
              name: name.trim(),
              mobile: mobile.trim(),
              email: email.trim(),
              role: "Customer",
              address: address.trim()
            }
          };

          login(authData);
          navigate("/store", { replace: true });
        } else {
          setError(res.error || "பதிவு செய்வதில் பிழை ஏற்பட்டுள்ளது. மீண்டும் முயற்சிக்கவும்.");
        }
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (m, p) => {
    setMode("login");
    setMobile(m);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col" data-testid="login-screen">
      <div className="bg-emerald-800 text-white px-4 py-10 sm:py-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #fbbf24 0, transparent 40%), radial-gradient(circle at 80% 20%, #ffffff 0, transparent 35%)" }} />
        <div className="relative max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase mb-4">
            <StoreIcon size={14} /> Fresh • Fair • Fast
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" data-testid="login-brand-title">
            3 Star Grocery Store
          </h1>
          <p className="font-tamil text-lg sm:text-xl font-bold text-amber-300 mt-1">3 ஸ்டார் மளிகை கடை</p>
          <p className="text-emerald-100/80 text-sm mt-3">தரமான அட்டை, சரம் &amp; லூஸ் பேக் பொருட்கள் — தினசரி நியாயமான விலையில்</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 -mt-6 pb-10">
        <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 fade-up" data-testid="login-form">
          <h2 className="text-xl font-bold text-slate-900">{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="text-sm text-slate-500 mb-6">{mode === "login" ? "Sign in with your mobile number" : "Register as a new customer"}</p>

          {mode === "register" && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Full Name</label>
              <input data-testid="register-name-input" required value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Your name" />
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Mobile Number or Email</label>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-600 overflow-hidden">
              <span className="pl-4 text-slate-400"><Phone size={16} /></span>
              <input data-testid="login-mobile-input" required value={mobile} onChange={(e) => setMobile(e.target.value.trim())}
                className="w-full px-3 py-3 text-sm focus:outline-none" placeholder="Mobile number or email" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-600 overflow-hidden">
              <span className="pl-4 text-slate-400"><Lock size={16} /></span>
              <input data-testid="login-password-input" required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-3 text-sm focus:outline-none" placeholder="••••••••" />
              <button type="button" data-testid="toggle-password-visibility" onClick={() => setShowPw(!showPw)} className="pr-4 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email (for email login)</label>
              <input data-testid="register-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="you@example.com" />
            </div>
          )}

          {mode === "register" && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Delivery Address</label>
              <textarea data-testid="register-address-input" value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Street, Area, City, PIN" />
            </div>
          )}

          {error && <div data-testid="login-error-message" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</div>}

          <button data-testid="login-submit-button" disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] transition text-white font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Register & Sign In"}
          </button>

          <button type="button" data-testid="auth-mode-toggle" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full mt-3 text-sm text-emerald-700 font-semibold hover:underline">
            {mode === "login" ? "New customer? Create an account" : "Already registered? Sign in"}
          </button>

          <div className="mt-6 pt-5 border-t border-dashed border-slate-200">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Quick demo access</p>
            <div className="flex gap-2">
              <button type="button" data-testid="demo-owner-button" onClick={() => fillDemo("shaludhana1116@gmail.com", "admin123")}
                className="flex-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg py-2 hover:bg-amber-100 transition">
                Owner Demo
              </button>
              <button type="button" data-testid="demo-customer-button" onClick={() => fillDemo("9000000002", "user123")}
                className="flex-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg py-2 hover:bg-emerald-100 transition">
                Customer Demo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}