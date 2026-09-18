# 3 Star Grocery Store (3 ஸ்டார் மளிகை கடை)

A full-stack grocery store web application with dual roles (Owner / Customer), Tamil product catalog, and an optional **Google Sheets database** powered by a Google Apps Script Web App.

> Made by **RI Billing Pro** · © 2026 3 Star Grocery Store

---

## Features

### Customer (User Store Dashboard)
- Browse **45+ Tamil products** across 3 categories: **Attai (மாவு)**, **Saram (மளிகை)**, **Loose Pack (லூஸ் பேக்)**
- Product cards with Tamil name, English sublabel, image, live rate and stock
- Search, category tabs, inline quantity steppers
- Cart drawer with **required delivery address**, UPI / Cash-on-Delivery checkout
- **My Orders** with live status tracking (Pending → Shipped → Delivered)
- **My Wishlist**, **My Payment History** (receipts), **My Account** (profile & address)

### Owner (Admin Dashboard)
- **Business Analytics**: total revenue, net profit (from delivered orders), collected/pending amounts, average bill value, order pipeline, low-stock alerts, recent bills
- **Rates & Inventory**: inline editing of rate, cost and stock for every product; add/delete products
- **Order Management**: update order status, mark Paid/Unpaid (auto-creates a transaction), customer address shown on every order
- **Transactions** ledger
- **Sheets Sync** tab: connection status + copyable Apps Script code

### Auth
- Login with **mobile number OR email** + password (bcrypt hashed, JWT Bearer tokens)
- Customer self-registration, role-based redirect, brute-force lockout (5 attempts → 15 min)

---

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, lucide-react icons, sonner toasts
- **Backend**: FastAPI (Python), Motor (MongoDB) / Google Apps Script (Sheets)
- **Database**: Google Sheets via Apps Script Web App **or** local MongoDB fallback (automatic)

---

## Demo Credentials

| Role | Login | Password |
|---|---|---|
| Owner | `9000000001` or `shaludhana1116@gmail.com` | `admin123` |
| Customer | `9000000002` or `customer@example.com` | `user123` |

---

## Google Sheets Setup (Apps Script)

The app runs on a local database until you connect your Google Sheet. To go live with Sheets:

1. Open your Google Sheet → **Extensions → Apps Script**
2. Delete any existing code, then **paste the full contents of `backend/apps_script/Code.gs`** and Save
3. Click **Deploy → New deployment → type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the **Web App URL**
5. Set it in `backend/.env`:
   ```
   APPS_SCRIPT_URL="https://script.google.com/macros/s/XXXX/exec"
   ```
6. Restart the backend — the app auto-switches to your Sheet and seeds the **Users** and **Products** sheets (45 products) on first run.

Sheets used: `Users`, `Products`, `Orders`, `Transactions`, `Wishlist` (auto-created with headers).

> After any change to Code.gs: **Deploy → Manage deployments → Edit → New version → Deploy**.

---

## Project Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI app — all /api routes, auth, Sheets/Mongo data layer
│   ├── apps_script/Code.gs    # Google Apps Script Web App (paste into script.google.com)
│   └── .env                   # MONGO_URL, DB_NAME, JWT_SECRET, APPS_SCRIPT_URL, owner creds
├── frontend/
│   └── src/
│       ├── App.js             # Router + auth context (/login, /admin, /store)
│       ├── pages/             # Login, Admin, Store
│       └── components/        # Header, Footer, admin/*, store/*
└── README.md
```

## API Overview (all prefixed with `/api`)

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/login` · `/auth/register` | public |
| GET | `/products` · POST/PUT/DELETE `/products` | GET: auth · write: Owner |
| POST | `/orders` · GET `/orders` · PUT `/orders/{id}` | Customer places · Owner updates |
| GET | `/transactions` | role-scoped |
| GET/POST/DELETE | `/wishlist` | Customer |
| PUT | `/profile` | Customer |
| GET | `/analytics/summary` · `/setup/status` · `/setup/apps-script` | Owner |

---

© 2026 3 Star Grocery Store · Made by **RI Billing Pro**
