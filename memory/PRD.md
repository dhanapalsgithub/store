# PRD — 3 Star Provisional Store (3 ஸ்டார் மளிகை கடை)

## Original Problem Statement
Full-stack web app "3 Star Provisional Store" with dual roles (Owner/Admin + Customer), Google Sheets via Google Apps Script as backend DB (Sheet ID: 1dVgh3ha6NXwP5G8dlsvNwLtzCLYltqe861xg4HQRvDo), mobile+password auth with role-based redirect, admin inventory/rate management + analytics + order management, customer store with category tabs (Attai / Saram / Loose Pack), cart/checkout, My Orders, Wishlist, Payment History, My Account. Tamil product names. Mobile-first Tailwind UI.

## User Choices
- No Apps Script URL yet → full Code.gs generated for user to deploy; app runs on MongoDB local fallback and auto-switches when APPS_SCRIPT_URL is set.
- Payments: record-only (UPI / Cash on Delivery), no gateway.
- 45 Tamil products auto-seeded (15 per category) with stock images.
- 3 categories: Attai (மாவு), Saram (மளிகை), Loose Pack.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), JWT Bearer auth (bcrypt), pluggable data layer: `SheetsStore` (Apps Script Web App, redirect-safe POST) or `MongoStore` fallback. Sheets: Users, Products, Orders, Transactions, Wishlist.
- Apps Script: `/app/backend/apps_script/Code.gs` (generic list/insert/update/delete protocol; auto-creates sheets with headers).
- Frontend: React + Tailwind (`/app/frontend/src`): Login, Admin (Overview/Inventory/Orders/Transactions/SheetsSetup), Store (Shop/CartDrawer/MyOrders/Wishlist/Payments/Account). Fonts: Outfit + DM Sans + Noto Sans Tamil. Theme: emerald/gold kirana palette.

## User Personas
- Owner: Shalu (shaludhana1116@gmail.com) — mobile 9000000001 / admin123
- Customer: demo 9000000002 / user123; self-registration enabled

## Implemented (2026-09-18)
- Mobile+password login/register, role-based redirect, brute-force lockout (5 tries/15 min, in-memory)
- 45 seeded Tamil products, 3 categories, images, rate + cost rate + stock
- Customer: category tabs, search, qty steppers, cart drawer (address + UPI/COD), order placement w/ stock decrement, orders with status stepper, wishlist, payment receipts, account editing
- Admin: analytics (revenue, net profit from delivered orders, collected/pending, avg bill, order pipeline, low stock), inline inventory editing + add/delete, order status + payment marking (auto-creates transaction), transactions table, Sheets Sync setup page with copyable Code.gs
- Tests: 27/27 backend pytest, all frontend flows pass (iteration_1.json)

## Backlog
- P0: User deploys Apps Script and sets APPS_SCRIPT_URL; verify Sheets-mode seeding (45 rows) works
- P1: Fix wishlist delete scoping for Sheets mode (composite key — currently deletes first ProductID match); printable bill/invoice PDF
- P2: Sales charts (recharts), date-range analytics, pagination for orders, customer management for owner, rate-history log
