import { useRef, useState } from "react";
import { Mic, X, Trash2, MapPin, Send, Square } from "lucide-react";
import { toast } from "sonner";
import api, { fmt, errMsg, waOrderLink } from "@/lib/api";
import { useAuth } from "@/App";

const ALIASES = [
  ["country sugar", "SA011"], ["rice flour", "AT001"], ["arisi mavu", "AT001"], ["idli", "AT002"],
  ["wheat", "AT003"], ["godhumai", "AT003"], ["atta", "AT003"], ["maida", "AT004"], ["ragi", "AT005"],
  ["bajra", "AT006"], ["kambu", "AT006"], ["jowar", "AT007"], ["cholam", "AT007"], ["besan", "AT008"],
  ["kadalai mavu", "AT008"], ["oats", "AT013"], ["corn flour", "AT015"],
  ["ponni", "SA001"], ["raw rice", "SA001"], ["boiled rice", "SA002"], ["basmati", "SA003"], ["seeraga", "SA004"],
  ["toor", "SA005"], ["thuvaram", "SA005"], ["moong", "SA006"], ["pasi paruppu", "SA006"], ["urad", "SA007"],
  ["ulundhu", "SA007"], ["chana", "SA008"], ["kadalai paruppu", "SA008"], ["chickpea", "SA009"], ["kondai", "SA009"],
  ["sugar", "SA010"], ["sarkarai", "SA010"], ["jaggery", "SA012"], ["vellam", "SA012"], ["salt", "SA013"],
  ["uppu", "SA013"], ["vermicelli", "SA014"], ["semiya", "SA014"], ["poha", "SA015"], ["aval", "SA015"],
  ["chilli", "LP001"], ["milagai", "LP001"], ["turmeric", "LP002"], ["manjal", "LP002"], ["coriander", "LP003"],
  ["malli", "LP003"], ["cumin", "LP004"], ["seeragam", "LP004"], ["jeera", "LP004"], ["mustard", "LP005"],
  ["kadugu", "LP005"], ["fenugreek", "LP006"], ["vendhayam", "LP006"], ["asafoetida", "LP007"], ["perungayam", "LP007"],
  ["gingelly", "LP008"], ["nallennai", "LP008"], ["sesame oil", "LP008"], ["coconut oil", "LP009"], ["thengai", "LP009"],
  ["ghee", "LP010"], ["ney", "LP010"], ["honey", "LP011"], ["cashew", "LP012"], ["mundhiri", "LP012"],
  ["almond", "LP013"], ["badam", "LP013"], ["raisin", "LP014"], ["thiratchai", "LP014"], ["sesame", "LP015"],
  ["ellu", "LP015"], ["oil", "LP008"], ["rice", "SA001"], ["dal", "SA005"], ["paruppu", "SA005"],
];

function parseVoiceOrder(text, products) {
  let work = ` ${text.toLowerCase()} `;
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const found = new Map();

  const tryMatch = (keyword, pid) => {
    const kw = keyword.toLowerCase();
    const idx = work.indexOf(kw);
    if (idx === -1 || found.has(pid) || !byId[pid] || byId[pid].stock <= 0) return;
    const before = work.slice(0, idx);
    const m = before.match(/(\d+(?:\.\d+)?)\s*(kg|kilos?|g|grams?|l|litres?|liters?|packs?|packets?)?\s*$/);
    let qty = m ? parseFloat(m[1]) : 1;
    if (m && m[2] && (m[2] === "g" || m[2].startsWith("gram"))) qty = Math.max(qty / 1000, 0.25);
    qty = Math.min(Math.max(Math.round(qty * 100) / 100, 0.25), byId[pid].stock);
    found.set(pid, { product: byId[pid], qty });
    const start = m ? idx - m[0].length : idx;
    work = work.slice(0, start) + " ".repeat(idx + kw.length - start) + work.slice(idx + kw.length);
  };

  [...products].sort((a, b) => b.nameEn.length - a.nameEn.length).forEach((p) => p.nameEn && tryMatch(p.nameEn, p.id));
  [...products].sort((a, b) => b.name.length - a.name.length).forEach((p) => p.name && tryMatch(p.name, p.id));
  [...ALIASES].sort((a, b) => b[0].length - a[0].length).forEach(([kw, pid]) => tryMatch(kw, pid));

  return [...found.values()];
}

export default function VoiceOrder({ products, onClose, onPlaced }) {
  const { user } = useAuth();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(user?.address || "");
  const [placing, setPlacing] = useState(false);
  const recRef = useRef(null);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported in this browser — please use Chrome or Edge");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "ta-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setTranscript(text);
        const found = parseVoiceOrder(text, products);
        setItems(found);
        if (found.length === 0) toast.info('No products matched. Try: "2 kg wheat atta, 1 kg sugar"');
        else toast.success(`${found.length} item(s) recognized`);
      };
      rec.onerror = () => { setListening(false); toast.error("Could not hear you — tap the mic and try again"); };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setTranscript("");
      setItems([]);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      toast.error("Voice input unavailable on this device");
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const total = items.reduce((s, i) => s + i.product.rate * i.qty, 0);

  const placeOrder = async () => {
    if (!items.length || placing) return;
    if (!address.trim()) {
      toast.error("Please enter your delivery address");
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
        paymentMethod: "Cash on Delivery",
        address,
      });
      window.open(waOrderLink(data, user), "_blank");
      toast.success(`Voice order ${data.id} placed — opening WhatsApp`);
      onPlaced();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-testid="voice-order-modal">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md p-6 fade-up max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">Voice Order</h3>
            <p className="font-tamil text-xs text-emerald-700">குரல் மூலம் ஆர்டர் செய்யுங்கள்</p>
          </div>
          <button data-testid="voice-close-button" onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"><X size={16} /></button>
        </div>

        <div className="flex flex-col items-center py-4">
          <button data-testid="voice-mic-button" onClick={listening ? stop : start}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition active:scale-95 ${listening ? "bg-red-500 shadow-lg shadow-red-500/40 animate-pulse" : "bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/30"}`}>
            {listening ? <Square size={26} className="text-white" /> : <Mic size={30} className="text-white" />}
          </button>
          <p className="text-xs font-semibold text-slate-500 mt-3" data-testid="voice-status-text">
            {listening ? "Listening… tap to stop" : "Tap the mic and speak your order"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 text-center">e.g. "2 kg wheat atta, 1 kg sugar, 1 litre oil" — தமிழிலும் பேசலாம்</p>
        </div>

        {transcript && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-3" data-testid="voice-transcript">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">You said</p>
            <p className="text-sm text-slate-700 font-tamil">“{transcript}”</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2 mb-3" data-testid="voice-parsed-items">
            {items.map((i) => (
              <div key={i.product.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                <div>
                  <p className="font-tamil text-sm font-bold text-slate-800">{i.product.name}</p>
                  <p className="text-[11px] text-slate-500">{i.qty} × {fmt(i.product.rate)} / {i.product.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-extrabold text-emerald-700 text-sm">{fmt(i.product.rate * i.qty)}</p>
                  <button data-testid={`voice-remove-${i.product.id}`}
                    onClick={() => setItems(items.filter((x) => x.product.id !== i.product.id))}
                    className="text-slate-300 hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <MapPin size={11} /> Delivery Address <span className="text-red-500">*</span>
          </label>
          <textarea data-testid="voice-address-input" value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Delivery address" />
        </div>

        <button data-testid="voice-place-order-button" onClick={placeOrder} disabled={items.length === 0 || placing}
          className="w-full bg-[#25D366] hover:bg-[#1eb856] text-white font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50">
          <Send size={15} /> {placing ? "Placing…" : `Place Order${items.length ? ` • ${fmt(total)}` : ""} & Send to WhatsApp`}
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">Order details open in WhatsApp to the store (99416 69513) after placing</p>
      </div>
    </div>
  );
}
