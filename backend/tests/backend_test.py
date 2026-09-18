"""Backend tests for 3 Star Provisional Store."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tamil-attai-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"mobile": "9000000001", "password": "admin123"}
CUSTOMER = {"mobile": "9000000002", "password": "user123"}


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json=OWNER, timeout=30)
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_token():
    r = requests.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _oh(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------- Health & auth --------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "ok"
        assert j["mode"] in ("local_fallback", "google_sheets")


class TestAuth:
    def test_owner_login(self):
        r = requests.post(f"{API}/auth/login", json=OWNER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "Owner"
        assert d["user"]["mobile"] == OWNER["mobile"]
        assert isinstance(d["token"], str) and len(d["token"]) > 10

    def test_customer_login(self):
        r = requests.post(f"{API}/auth/login", json=CUSTOMER, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "Customer"

    def test_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"mobile": OWNER["mobile"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401
        assert "Invalid" in r.json().get("detail", "")

    def test_me(self, customer_token):
        r = requests.get(f"{API}/auth/me", headers=_oh(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["mobile"] == CUSTOMER["mobile"]

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# -------- Products --------
class TestProducts:
    def test_45_seeded_products(self):
        r = requests.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert len(products) >= 45, f"expected 45+, got {len(products)}"

    def test_three_categories_15_each(self):
        for cat in ["Attai", "Saram", "Loose Pack"]:
            r = requests.get(f"{API}/products", params={"category": cat}, timeout=15)
            assert r.status_code == 200
            items = r.json()
            assert len(items) >= 15, f"category {cat} has {len(items)}"
            # verify Tamil names present
            assert any(any(ord(ch) > 127 for ch in (it.get("name") or "")) for it in items), f"no tamil names in {cat}"

    def test_product_shape(self):
        r = requests.get(f"{API}/products", timeout=15).json()
        p = r[0]
        for k in ("id", "name", "rate", "stock", "category"):
            assert k in p


# -------- Owner Product CRUD --------
class TestOwnerProductCRUD:
    _created_id = None

    def test_add_product(self, owner_token):
        payload = {
            "category": "Attai",
            "productName": "TEST_பரிசோதனை",
            "productNameEn": "TEST_Test Product",
            "rate": 100.0,
            "costRate": 80.0,
            "stockQty": 20,
            "unit": "1 kg",
        }
        r = requests.post(f"{API}/products", json=payload, headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["rate"] == 100.0 and p["stock"] == 20
        TestOwnerProductCRUD._created_id = p["id"]

    def test_update_product(self, owner_token):
        pid = TestOwnerProductCRUD._created_id
        assert pid
        r = requests.put(f"{API}/products/{pid}", json={"rate": 150.0, "stockQty": 30},
                         headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["rate"] == 150.0
        # verify persisted
        r2 = requests.get(f"{API}/products", timeout=15).json()
        prod = next(p for p in r2 if p["id"] == pid)
        assert prod["rate"] == 150.0 and prod["stock"] == 30

    def test_customer_cannot_add_product(self, customer_token):
        r = requests.post(f"{API}/products", json={"category": "Attai", "productName": "X", "rate": 1, "stockQty": 1},
                          headers=_oh(customer_token), timeout=15)
        assert r.status_code == 403

    def test_delete_product(self, owner_token):
        pid = TestOwnerProductCRUD._created_id
        r = requests.delete(f"{API}/products/{pid}", headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        # verify gone
        products = requests.get(f"{API}/products", timeout=15).json()
        assert not any(p["id"] == pid for p in products)


# -------- Orders & transactions --------
class TestOrdersFlow:
    _cod_id = None
    _upi_id = None

    def test_place_cod_order(self, customer_token):
        products = requests.get(f"{API}/products", timeout=15).json()
        p = next(p for p in products if p["stock"] > 2)
        stock_before = p["stock"]
        body = {"items": [{"productId": p["id"], "qty": 2}], "paymentMethod": "COD", "address": "Test Addr"}
        r = requests.post(f"{API}/orders", json=body, headers=_oh(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["paymentMethod"] == "COD" and o["paymentStatus"] == "Unpaid"
        assert o["status"] == "Pending"
        TestOrdersFlow._cod_id = o["id"]
        # stock decrement
        products2 = requests.get(f"{API}/products", timeout=15).json()
        p2 = next(x for x in products2 if x["id"] == p["id"])
        assert p2["stock"] == stock_before - 2

    def test_place_upi_creates_transaction(self, customer_token):
        products = requests.get(f"{API}/products", timeout=15).json()
        p = next(p for p in products if p["stock"] > 1)
        body = {"items": [{"productId": p["id"], "qty": 1}], "paymentMethod": "UPI"}
        r = requests.post(f"{API}/orders", json=body, headers=_oh(customer_token), timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["paymentStatus"] == "Paid"
        TestOrdersFlow._upi_id = o["id"]
        # tx exists
        tx = requests.get(f"{API}/transactions", headers=_oh(customer_token), timeout=15).json()
        assert any(t["orderId"] == o["id"] for t in tx)

    def test_customer_sees_only_own_orders(self, customer_token):
        orders = requests.get(f"{API}/orders", headers=_oh(customer_token), timeout=15).json()
        assert all(o["customerMobile"] == CUSTOMER["mobile"] for o in orders)

    def test_owner_status_transition(self, owner_token):
        oid = TestOrdersFlow._cod_id
        for st in ["Shipped", "Delivered"]:
            r = requests.put(f"{API}/orders/{oid}", json={"status": st}, headers=_oh(owner_token), timeout=15)
            assert r.status_code == 200
            assert r.json()["status"] == st

    def test_owner_mark_paid_creates_tx(self, owner_token):
        oid = TestOrdersFlow._cod_id
        r = requests.put(f"{API}/orders/{oid}", json={"paymentStatus": "Paid", "paymentMethod": "Cash"},
                         headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["paymentStatus"] == "Paid"
        tx = requests.get(f"{API}/transactions", headers=_oh(owner_token), timeout=15).json()
        assert any(t["orderId"] == oid for t in tx)

    def test_empty_cart_400(self, customer_token):
        r = requests.post(f"{API}/orders", json={"items": [], "paymentMethod": "COD"}, headers=_oh(customer_token), timeout=15)
        assert r.status_code == 400

    def test_customer_cannot_update_order(self, customer_token):
        oid = TestOrdersFlow._cod_id
        r = requests.put(f"{API}/orders/{oid}", json={"status": "Cancelled"}, headers=_oh(customer_token), timeout=15)
        assert r.status_code == 403


# -------- Wishlist --------
class TestWishlist:
    def test_add_and_remove(self, customer_token):
        products = requests.get(f"{API}/products", timeout=15).json()
        pid = products[0]["id"]
        r = requests.post(f"{API}/wishlist", json={"productId": pid}, headers=_oh(customer_token), timeout=15)
        assert r.status_code == 200
        wl = requests.get(f"{API}/wishlist", headers=_oh(customer_token), timeout=15).json()
        assert any(p["id"] == pid for p in wl)
        r2 = requests.delete(f"{API}/wishlist/{pid}", headers=_oh(customer_token), timeout=15)
        assert r2.status_code == 200
        wl2 = requests.get(f"{API}/wishlist", headers=_oh(customer_token), timeout=15).json()
        assert not any(p["id"] == pid for p in wl2)


# -------- Profile --------
class TestProfile:
    def test_update_profile(self, customer_token):
        r = requests.put(f"{API}/profile", json={"name": "Demo Customer", "address": "TEST_Addr 123"},
                         headers=_oh(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["address"] == "TEST_Addr 123"
        # verify via me
        me = requests.get(f"{API}/auth/me", headers=_oh(customer_token), timeout=15).json()
        assert me["address"] == "TEST_Addr 123"


# -------- Analytics guard --------
class TestAnalytics:
    def test_owner_ok(self, owner_token):
        r = requests.get(f"{API}/analytics/summary", headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ("totalRevenue", "netProfit", "totalBills", "recentOrders"):
            assert k in j

    def test_customer_forbidden(self, customer_token):
        r = requests.get(f"{API}/analytics/summary", headers=_oh(customer_token), timeout=15)
        assert r.status_code == 403


# -------- Setup / Sheets --------
class TestSetup:
    def test_status(self, owner_token):
        r = requests.get(f"{API}/setup/status", headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["mode"] == "local_fallback"
        assert j["appsScriptConfigured"] is False

    def test_apps_script_code(self, owner_token):
        r = requests.get(f"{API}/setup/apps-script", headers=_oh(owner_token), timeout=15)
        assert r.status_code == 200
        assert len(r.json()["code"]) > 100

    def test_customer_forbidden_setup(self, customer_token):
        r = requests.get(f"{API}/setup/status", headers=_oh(customer_token), timeout=15)
        assert r.status_code == 403
