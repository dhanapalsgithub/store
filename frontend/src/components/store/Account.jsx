import { useState } from "react";
import { UserCircle, MapPin, Phone, Mail, Save, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import api, { errMsg } from "@/lib/api";
import { useAuth } from "@/App";

export default function Account() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [address, setAddress] = useState(user?.address || "");
  const [userType, setUserType] = useState(user?.userType || "Retail");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/profile", { name, address, userType });
      setUser(data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 fade-up max-w-2xl" data-testid="my-account">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Account</h2>
        <p className="text-sm text-slate-500">எனது சுயவிவரம் — profile & delivery address</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center">
          <UserCircle size={28} className="text-white" />
        </div>
        <div>
          <p className="font-extrabold text-slate-900 text-lg" data-testid="account-name-display">{user?.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} /> {user?.mobile}</p>
          {user?.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail size={11} /> {user?.email}</p>}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 mt-1">
            <BadgeCheck size={11} /> {user?.role} • {user?.userType}
          </span>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" data-testid="account-form">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Full Name</label>
          <input data-testid="account-name-input" required value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1"><MapPin size={11} /> Delivery Address</label>
          <textarea data-testid="account-address-input" value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Street, Area, City, PIN" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer Type</label>
          <select data-testid="account-usertype-select" value={userType} onChange={(e) => setUserType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600">
            <option>Retail</option>
            <option>Wholesale</option>
          </select>
        </div>
        <button data-testid="account-save-button" disabled={saving}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl px-6 py-3 text-sm flex items-center gap-2 transition active:scale-95 disabled:opacity-60">
          <Save size={15} /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
