from dotenv import load_dotenv
load_dotenv()

import os
import json
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

ROOT_DIR = Path(__file__).parent
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "").strip()

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ----------------------------------------------------------------------------
# Data layer: Google Sheets (via Apps Script) with MongoDB fallback
# ----------------------------------------------------------------------------

class MongoStore:
    mode = "local_fallback"

    async def list_rows(self, sheet):
        return await db[sheet.lower()].find({}, {"_id": 0}).to_list(20000)

    async def insert_row(self, sheet, row):
        await db[sheet.lower()].insert_one(dict(row))
        return row

    async def update_row(self, sheet, key, value, patch):
        r = await db[sheet.lower()].update_one({key: str(value)}, {"$set": patch})
        if r.matched_count == 0:
            r = await db[sheet.lower()].update_one({key: value}, {"$set": patch})
        return r.matched_count > 0

    async def delete_row(self, sheet, key, value):
        r = await db[sheet.lower()].delete_one({key: str(value)})
        if r.deleted_count == 0:
            r = await db[sheet.lower()].delete_one({key: value})
        return r.deleted_count > 0


class SheetsStore:
    mode = "google_sheets"

    def __init__(self, url):
        self.url = url

    def _post(self, payload):
        s = requests.Session()
        r = s.post(self.url, json=payload, allow_redirects=False, timeout=40)
        if r.status_code in (301, 302, 303, 307, 308):
            r = s.post(r.headers["Location"], json=payload, allow_redirects=True, timeout=40)
        return r.json()

    async def _call(self, payload):
        try:
            res = await asyncio.to_thread(self._post, payload)
        except Exception as e:
            logger.error(f"Apps Script call failed: {e}")
            raise HTTPException(status_code=502, detail="Google Sheets backend unreachable")
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "Sheets backend error"))
        return res.get("data")

    async def list_rows(self, sheet):
        return await self._call({"action": "list", "sheet": sheet}) or []

    async def insert_row(self, sheet, row):
        return await self._call({"action": "insert", "sheet": sheet, "row": row})

    async def update_row(self, sheet, key, value, patch):
        return await self._call({"action": "update", "sheet": sheet, "key": key, "value": value, "row": patch})

    async def delete_row(self, sheet, key, value):
        return await self._call({"action": "delete", "sheet": sheet, "key": key, "value": value})


store = SheetsStore(APPS_SCRIPT_URL) if APPS_SCRIPT_URL else MongoStore()

# ----------------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------------
security = HTTPBearer()
_login_attempts = {}


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": str(user["Mobile"]),
        "role": user["Role"],
        "name": user.get("Name", ""),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    users = await store.list_rows("Users")
    user = next((u for u in users if str(u.get("Mobile")) == payload["sub"]), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def owner_only(user=Depends(current_user)):
    if user.get("Role") != "Owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return user


def public_user(u: dict) -> dict:
    return {
        "mobile": str(u.get("Mobile")),
        "name": u.get("Name", ""),
        "role": u.get("Role"),
        "email": u.get("Email", ""),
        "address": u.get("Address", ""),
        "userType": u.get("UserType", "Retail"),
    }


# ----------------------------------------------------------------------------
# Seed data
# ----------------------------------------------------------------------------
IMG = {
    "flour1": "https://images.unsplash.com/photo-1586137712370-9b450509c587?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "flour2": "https://images.unsplash.com/photo-1610663711502-35f870cfaea2?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "flour3": "https://images.pexels.com/photos/6287219/pexels-photo-6287219.jpeg?auto=compress&cs=tinysrgb&w=640",
    "flour4": "https://images.pexels.com/photos/6294375/pexels-photo-6294375.jpeg?auto=compress&cs=tinysrgb&w=640",
    "flour5": "https://images.pexels.com/photos/8136878/pexels-photo-8136878.jpeg?auto=compress&cs=tinysrgb&w=640",
    "flour6": "https://images.pexels.com/photos/8093420/pexels-photo-8093420.jpeg?auto=compress&cs=tinysrgb&w=640",
    "rice1": "https://images.unsplash.com/photo-1643622357625-c013987d90e7?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "rice2": "https://images.unsplash.com/photo-1686820740687-426a7b9b2043?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "rice3": "https://images.unsplash.com/photo-1586201375761-83865001e31c?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "rice4": "https://images.unsplash.com/photo-1723475158232-819e29803f4d?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "bowl1": "https://images.unsplash.com/photo-1705147271933-5c7052f15a90?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "bowl2": "https://images.unsplash.com/photo-1704916029292-ec7b5976204c?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "dal1": "https://images.unsplash.com/photo-1714062105923-5cb2a3a07499?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "dal2": "https://images.unsplash.com/photo-1714062108809-7ca61cb88045?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "dal3": "https://images.unsplash.com/photo-1714062108799-09d77a41383e?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "dal4": "https://images.unsplash.com/photo-1714062105876-1756a22c4caf?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "sugar1": "https://images.pexels.com/photos/8481896/pexels-photo-8481896.jpeg?auto=compress&cs=tinysrgb&w=640",
    "sugar2": "https://images.pexels.com/photos/29120850/pexels-photo-29120850.jpeg?auto=compress&cs=tinysrgb&w=640",
    "spice1": "https://images.pexels.com/photos/2632292/pexels-photo-2632292.jpeg?auto=compress&cs=tinysrgb&w=640",
    "spice2": "https://images.unsplash.com/photo-1656497119922-068c6a5e1193?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "spice3": "https://images.unsplash.com/photo-1525289722380-f5bf1653d504?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "spice4": "https://images.unsplash.com/photo-1773869910193-c7ae23145ac9?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "spice5": "https://images.unsplash.com/photo-1486548730767-5c679e8eda6b?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "spice6": "https://images.unsplash.com/photo-1610012370944-e822e8bb91c5?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "spice7": "https://images.pexels.com/photos/31280796/pexels-photo-31280796.jpeg?auto=compress&cs=tinysrgb&w=640",
    "oil1": "https://images.unsplash.com/photo-1552592074-ea7a91b851b3?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "oil2": "https://images.unsplash.com/photo-1707827914998-0d56ee13c161?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "oil3": "https://images.pexels.com/photos/6213754/pexels-photo-6213754.jpeg?auto=compress&cs=tinysrgb&w=640",
    "oil4": "https://images.unsplash.com/photo-1654245201134-49f7e8115817?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "nuts1": "https://images.unsplash.com/photo-1769255484443-50e4e3e2bbdb?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "nuts2": "https://images.pexels.com/photos/9615877/pexels-photo-9615877.jpeg?auto=compress&cs=tinysrgb&w=640",
    "nuts3": "https://images.unsplash.com/photo-1671981200629-014c03829abb?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
    "nuts4": "https://images.pexels.com/photos/3682190/pexels-photo-3682190.jpeg?auto=compress&cs=tinysrgb&w=640",
}


def P(pid, cat, ta, en, rate, stock, unit, img):
    return {
        "ProductID": pid, "Category": cat, "ProductName": ta, "ProductNameEn": en,
        "Rate": rate, "CostRate": round(rate * 0.82, 2), "StockQty": stock, "Unit": unit, "Image": IMG[img],
    }


SEED_PRODUCTS = [
    P("AT001", "Attai", "பச்சரிசி மாவு", "Raw Rice Flour", 48, 60, "1 kg", "flour1"),
    P("AT002", "Attai", "இட்லி மாவு", "Idli Flour", 52, 45, "1 kg", "flour6"),
    P("AT003", "Attai", "கோதுமை மாவு", "Wheat Atta", 55, 80, "1 kg", "flour3"),
    P("AT004", "Attai", "மைதா மாவு", "Maida", 44, 50, "1 kg", "flour4"),
    P("AT005", "Attai", "ராகி மாவு", "Ragi Flour", 60, 40, "1 kg", "flour2"),
    P("AT006", "Attai", "கம்பு மாவு", "Bajra Flour", 58, 35, "1 kg", "flour1"),
    P("AT007", "Attai", "சோளம் மாவு", "Jowar Flour", 56, 35, "1 kg", "flour2"),
    P("AT008", "Attai", "கடலை மாவு", "Besan Flour", 72, 55, "1 kg", "flour5"),
    P("AT009", "Attai", "தினை மாவு", "Foxtail Millet Flour", 65, 30, "1 kg", "flour1"),
    P("AT010", "Attai", "சாமை மாவு", "Little Millet Flour", 66, 30, "1 kg", "flour6"),
    P("AT011", "Attai", "கேழ்வரகு மாவு", "Kodo Millet Flour", 64, 28, "1 kg", "flour2"),
    P("AT012", "Attai", "பார்லி மாவு", "Barley Flour", 62, 25, "1 kg", "flour3"),
    P("AT013", "Attai", "ஓட்ஸ் மாவு", "Oats Flour", 85, 22, "1 kg", "flour4"),
    P("AT014", "Attai", "பொட்டுக்கடலை மாவு", "Roasted Gram Flour", 78, 33, "1 kg", "flour5"),
    P("AT015", "Attai", "மக்காச்சோள மாவு", "Corn Flour", 50, 48, "1 kg", "flour1"),
    P("SA001", "Saram", "பொன்னி பச்சரிசி", "Ponni Raw Rice", 62, 120, "1 kg", "rice1"),
    P("SA002", "Saram", "புழுங்கல் அரிசி", "Boiled Rice", 55, 110, "1 kg", "rice2"),
    P("SA003", "Saram", "பாசுமதி அரிசி", "Basmati Rice", 120, 60, "1 kg", "rice3"),
    P("SA004", "Saram", "சீரகசம்பா அரிசி", "Seeraga Samba Rice", 145, 40, "1 kg", "rice4"),
    P("SA005", "Saram", "துவரம் பருப்பு", "Toor Dal", 140, 70, "1 kg", "dal1"),
    P("SA006", "Saram", "பாசிப்பருப்பு", "Moong Dal", 130, 65, "1 kg", "dal2"),
    P("SA007", "Saram", "உளுந்தம் பருப்பு", "Urad Dal", 125, 65, "1 kg", "dal3"),
    P("SA008", "Saram", "கடலைப்பருப்பு", "Chana Dal", 90, 75, "1 kg", "dal4"),
    P("SA009", "Saram", "கொண்டைக்கடலை", "Chickpeas", 95, 60, "1 kg", "dal1"),
    P("SA010", "Saram", "சர்க்கரை", "Sugar", 45, 100, "1 kg", "sugar1"),
    P("SA011", "Saram", "நாட்டுச் சர்க்கரை", "Country Sugar", 70, 50, "1 kg", "sugar2"),
    P("SA012", "Saram", "வெல்லம்", "Jaggery", 80, 55, "1 kg", "sugar1"),
    P("SA013", "Saram", "உப்பு", "Salt", 25, 90, "1 kg", "bowl1"),
    P("SA014", "Saram", "சேமியா", "Vermicelli", 40, 45, "500 g", "bowl2"),
    P("SA015", "Saram", "அவல்", "Aval (Poha)", 50, 40, "500 g", "bowl1"),
    P("LP001", "Loose Pack", "மிளகாய்த்தூள்", "Chilli Powder (Loose)", 180, 40, "1 kg", "spice1"),
    P("LP002", "Loose Pack", "மஞ்சள் தூள்", "Turmeric Powder (Loose)", 160, 42, "1 kg", "spice2"),
    P("LP003", "Loose Pack", "மல்லித் தூள்", "Coriander Powder (Loose)", 150, 38, "1 kg", "spice3"),
    P("LP004", "Loose Pack", "சீரகம்", "Cumin Seeds (Loose)", 320, 25, "1 kg", "spice4"),
    P("LP005", "Loose Pack", "கடுகு", "Mustard Seeds (Loose)", 120, 30, "1 kg", "spice5"),
    P("LP006", "Loose Pack", "வெந்தயம்", "Fenugreek (Loose)", 90, 28, "1 kg", "spice6"),
    P("LP007", "Loose Pack", "பேருங்காயம்", "Asafoetida", 240, 20, "100 g", "spice7"),
    P("LP008", "Loose Pack", "நல்லெண்ணெய்", "Gingelly Oil", 210, 50, "1 L", "oil1"),
    P("LP009", "Loose Pack", "தேங்காய் எண்ணெய்", "Coconut Oil", 190, 45, "1 L", "oil2"),
    P("LP010", "Loose Pack", "நெய்", "Ghee", 550, 25, "1 L", "oil3"),
    P("LP011", "Loose Pack", "தேன்", "Honey", 180, 30, "500 g", "oil4"),
    P("LP012", "Loose Pack", "முந்திரி", "Cashew (Loose)", 720, 22, "1 kg", "nuts1"),
    P("LP013", "Loose Pack", "பாதாம்", "Almonds (Loose)", 780, 20, "1 kg", "nuts2"),
    P("LP014", "Loose Pack", "திராட்சை", "Raisins (Loose)", 340, 26, "1 kg", "nuts3"),
    P("LP015", "Loose Pack", "எள்", "Sesame Seeds (Loose)", 160, 32, "1 kg", "nuts4"),
]


async def seed_data():
    users = await store.list_rows("Users")
    owner_mobile = os.environ["OWNER_MOBILE"]
    if not any(str(u.get("Mobile")) == owner_mobile for u in users):
        await store.insert_row("Users", {
            "Mobile": owner_mobile,
            "Password": hash_password(os.environ["OWNER_PASSWORD"]),
            "Role": "Owner", "Name": "Shalu (Owner)",
            "Email": os.environ.get("OWNER_EMAIL", ""),
            "Address": "3 Star Provisional Store, Main Road", "UserType": "Wholesale",
        })
        logger.info("Seeded owner account")
    if not any(str(u.get("Mobile")) == "9000000002" for u in users):
        await store.insert_row("Users", {
            "Mobile": "9000000002", "Password": hash_password("user123"),
            "Role": "Customer", "Name": "Demo Customer", "Email": "customer@example.com",
            "Address": "12, Bazaar Street, Madurai - 625001", "UserType": "Retail",
        })
        logger.info("Seeded demo customer")
    products = await store.list_rows("Products")
    if not products:
        for p in SEED_PRODUCTS:
            await store.insert_row("Products", p)
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")


# ----------------------------------------------------------------------------
# App & models
# ----------------------------------------------------------------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")


class LoginBody(BaseModel):
    identifier: Optional[str] = None
    mobile: Optional[str] = None
    password: str


class RegisterBody(BaseModel):
    name: str
    mobile: str
    password: str
    email: Optional[str] = ""
    address: Optional[str] = ""


class ProfileBody(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    userType: Optional[str] = None


class ProductBody(BaseModel):
    category: str
    productName: str
    productNameEn: Optional[str] = ""
    rate: float
    costRate: Optional[float] = 0
    stockQty: float
    unit: Optional[str] = "1 kg"
    image: Optional[str] = ""


class ProductPatch(BaseModel):
    rate: Optional[float] = None
    costRate: Optional[float] = None
    stockQty: Optional[float] = None
    productName: Optional[str] = None
    productNameEn: Optional[str] = None
    unit: Optional[str] = None
    image: Optional[str] = None
    category: Optional[str] = None


class OrderItem(BaseModel):
    productId: str
    qty: float


class OrderBody(BaseModel):
    items: List[OrderItem]
    paymentMethod: str = "Cash on Delivery"
    address: Optional[str] = ""


class OrderPatch(BaseModel):
    status: Optional[str] = None
    paymentStatus: Optional[str] = None
    paymentMethod: Optional[str] = None


class WishlistBody(BaseModel):
    productId: str


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def norm_product(p: dict) -> dict:
    return {
        "id": str(p.get("ProductID")),
        "category": p.get("Category", ""),
        "name": p.get("ProductName", ""),
        "nameEn": p.get("ProductNameEn", ""),
        "rate": num(p.get("Rate")),
        "costRate": num(p.get("CostRate")),
        "stock": num(p.get("StockQty")),
        "unit": p.get("Unit", "1 kg"),
        "image": p.get("Image", ""),
    }


def norm_order(o: dict) -> dict:
    try:
        items = json.loads(o.get("ItemsJSON", "[]")) if isinstance(o.get("ItemsJSON"), str) else o.get("ItemsJSON", [])
    except Exception:
        items = []
    return {
        "id": str(o.get("OrderID")),
        "customerMobile": str(o.get("CustomerMobile")),
        "customerName": o.get("CustomerName", ""),
        "items": items,
        "total": num(o.get("TotalAmount")),
        "paymentStatus": o.get("PaymentStatus", "Unpaid"),
        "paymentMethod": o.get("PaymentMethod", ""),
        "date": str(o.get("Date", "")),
        "status": o.get("Status", "Pending"),
        "address": o.get("Address", ""),
    }


def norm_txn(t: dict) -> dict:
    return {
        "id": str(t.get("TransactionID")),
        "orderId": str(t.get("OrderID", "")),
        "customerMobile": str(t.get("CustomerMobile")),
        "amount": num(t.get("Amount")),
        "method": t.get("PaymentMethod", ""),
        "date": str(t.get("Date", "")),
    }


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "3 Star Provisional Store API", "mode": store.mode}


@api_router.get("/health")
async def health():
    return {"status": "ok", "mode": store.mode}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    login_id = (body.identifier or body.mobile or "").strip()
    if not login_id:
        raise HTTPException(status_code=400, detail="Enter your mobile number or email")
    key = login_id.lower()
    locked_until = _login_attempts.get(key, {}).get("locked_until")
    if locked_until and datetime.now(timezone.utc) < locked_until:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    users = await store.list_rows("Users")
    user = next((u for u in users if str(u.get("Mobile")) == login_id or str(u.get("Email", "")).lower() == key), None)
    if not user or not verify_password(body.password, str(user.get("Password", ""))):
        rec = _login_attempts.setdefault(key, {"count": 0})
        rec["count"] += 1
        if rec["count"] >= 5:
            rec["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
            rec["count"] = 0
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")
    _login_attempts.pop(key, None)
    return {"token": create_token(user), "user": public_user(user)}


@api_router.post("/auth/register")
async def register(body: RegisterBody):
    if len(body.mobile) < 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number")
    users = await store.list_rows("Users")
    if any(str(u.get("Mobile")) == body.mobile for u in users):
        raise HTTPException(status_code=400, detail="Mobile number already registered")
    email = body.email.strip().lower()
    if email and any(str(u.get("Email", "")).lower() == email for u in users):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "Mobile": body.mobile, "Password": hash_password(body.password),
        "Role": "Customer", "Name": body.name, "Email": email,
        "Address": body.address or "", "UserType": "Retail",
    }
    await store.insert_row("Users", user)
    return {"token": create_token(user), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api_router.put("/profile")
async def update_profile(body: ProfileBody, user=Depends(current_user)):
    patch = {}
    if body.name is not None:
        patch["Name"] = body.name
    if body.address is not None:
        patch["Address"] = body.address
    if body.userType is not None:
        patch["UserType"] = body.userType
    if patch:
        await store.update_row("Users", "Mobile", str(user["Mobile"]), patch)
    users = await store.list_rows("Users")
    updated = next(u for u in users if str(u.get("Mobile")) == str(user["Mobile"]))
    return public_user(updated)


@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    products = [norm_product(p) for p in await store.list_rows("Products")]
    if category:
        products = [p for p in products if p["category"].lower() == category.lower()]
    return products


@api_router.post("/products")
async def add_product(body: ProductBody, user=Depends(owner_only)):
    pid = "P" + uuid.uuid4().hex[:6].upper()
    row = {
        "ProductID": pid, "Category": body.category, "ProductName": body.productName,
        "ProductNameEn": body.productNameEn or "", "Rate": body.rate,
        "CostRate": body.costRate or round(body.rate * 0.82, 2), "StockQty": body.stockQty,
        "Unit": body.unit or "1 kg",
        "Image": body.image or "https://images.pexels.com/photos/7421306/pexels-photo-7421306.jpeg?auto=compress&cs=tinysrgb&w=640",
    }
    await store.insert_row("Products", row)
    return norm_product(row)


@api_router.put("/products/{pid}")
async def update_product(pid: str, body: ProductPatch, user=Depends(owner_only)):
    field_map = {"rate": "Rate", "costRate": "CostRate", "stockQty": "StockQty", "productName": "ProductName",
                 "productNameEn": "ProductNameEn", "unit": "Unit", "image": "Image", "category": "Category"}
    patch = {field_map[k]: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        ok = await store.update_row("Products", "ProductID", pid, patch)
        if not ok:
            raise HTTPException(status_code=404, detail="Product not found")
    products = await store.list_rows("Products")
    prod = next((p for p in products if str(p.get("ProductID")) == pid), None)
    return norm_product(prod)


@api_router.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(owner_only)):
    ok = await store.delete_row("Products", "ProductID", pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": True}


@api_router.post("/orders")
async def place_order(body: OrderBody, user=Depends(current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    products = {str(p.get("ProductID")): p for p in await store.list_rows("Products")}
    items = []
    total = 0.0
    for it in body.items:
        p = products.get(it.productId)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {it.productId} not found")
        stock = num(p.get("StockQty"))
        if it.qty <= 0 or it.qty > stock:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {p.get('ProductName')} (available: {stock:g})")
        rate = num(p.get("Rate"))
        items.append({
            "productId": it.productId, "name": p.get("ProductName"), "nameEn": p.get("ProductNameEn", ""),
            "qty": it.qty, "rate": rate, "costRate": num(p.get("CostRate")), "unit": p.get("Unit", "1 kg"),
        })
        total += rate * it.qty
    for it in body.items:
        p = products[it.productId]
        await store.update_row("Products", "ProductID", it.productId,
                               {"StockQty": num(p.get("StockQty")) - it.qty})
    order_id = "3S" + datetime.now(timezone.utc).strftime("%y%m%d") + uuid.uuid4().hex[:5].upper()
    paid = body.paymentMethod == "UPI"
    now = datetime.now(timezone.utc).isoformat()
    order = {
        "OrderID": order_id, "CustomerMobile": str(user["Mobile"]),
        "CustomerName": user.get("Name", ""), "ItemsJSON": json.dumps(items),
        "TotalAmount": round(total, 2), "PaymentStatus": "Paid" if paid else "Unpaid",
        "PaymentMethod": body.paymentMethod, "Date": now, "Status": "Pending",
        "Address": body.address or user.get("Address", ""),
    }
    await store.insert_row("Orders", order)
    if paid:
        await store.insert_row("Transactions", {
            "TransactionID": "TXN" + uuid.uuid4().hex[:8].upper(), "OrderID": order_id,
            "CustomerMobile": str(user["Mobile"]), "Amount": round(total, 2),
            "PaymentMethod": "UPI", "Date": now,
        })
    return norm_order(order)


@api_router.get("/orders")
async def list_orders(user=Depends(current_user)):
    orders = [norm_order(o) for o in await store.list_rows("Orders")]
    if user.get("Role") != "Owner":
        orders = [o for o in orders if o["customerMobile"] == str(user["Mobile"])]
    return sorted(orders, key=lambda o: o["date"], reverse=True)


@api_router.put("/orders/{oid}")
async def update_order(oid: str, body: OrderPatch, user=Depends(owner_only)):
    orders = await store.list_rows("Orders")
    order = next((o for o in orders if str(o.get("OrderID")) == oid), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    patch = {}
    if body.status:
        patch["Status"] = body.status
    if body.paymentStatus:
        patch["PaymentStatus"] = body.paymentStatus
    if body.paymentMethod:
        patch["PaymentMethod"] = body.paymentMethod
    if patch:
        await store.update_row("Orders", "OrderID", oid, patch)
    if body.paymentStatus == "Paid" and order.get("PaymentStatus") != "Paid":
        txns = await store.list_rows("Transactions")
        if not any(str(t.get("OrderID")) == oid for t in txns):
            await store.insert_row("Transactions", {
                "TransactionID": "TXN" + uuid.uuid4().hex[:8].upper(), "OrderID": oid,
                "CustomerMobile": str(order.get("CustomerMobile")), "Amount": num(order.get("TotalAmount")),
                "PaymentMethod": body.paymentMethod or order.get("PaymentMethod") or "Cash", 
                "Date": datetime.now(timezone.utc).isoformat(),
            })
    orders = await store.list_rows("Orders")
    return norm_order(next(o for o in orders if str(o.get("OrderID")) == oid))


@api_router.get("/transactions")
async def list_transactions(user=Depends(current_user)):
    txns = [norm_txn(t) for t in await store.list_rows("Transactions")]
    if user.get("Role") != "Owner":
        txns = [t for t in txns if t["customerMobile"] == str(user["Mobile"])]
    return sorted(txns, key=lambda t: t["date"], reverse=True)


@api_router.get("/wishlist")
async def get_wishlist(user=Depends(current_user)):
    wl = await store.list_rows("Wishlist")
    ids = [str(w.get("ProductID")) for w in wl if str(w.get("CustomerMobile")) == str(user["Mobile"])]
    products = [norm_product(p) for p in await store.list_rows("Products") if str(p.get("ProductID")) in ids]
    return products


@api_router.post("/wishlist")
async def add_wishlist(body: WishlistBody, user=Depends(current_user)):
    wl = await store.list_rows("Wishlist")
    exists = any(str(w.get("CustomerMobile")) == str(user["Mobile"]) and str(w.get("ProductID")) == body.productId for w in wl)
    if not exists:
        await store.insert_row("Wishlist", {"CustomerMobile": str(user["Mobile"]), "ProductID": body.productId})
    return {"added": True}


@api_router.delete("/wishlist/{pid}")
async def remove_wishlist(pid: str, user=Depends(current_user)):
    if store.mode == "local_fallback":
        await db["wishlist"].delete_one({"CustomerMobile": str(user["Mobile"]), "ProductID": pid})
    else:
        wl = await store.list_rows("Wishlist")
        # Sheets rows lack composite keys; remove by rewriting not supported — delete first match via ProductID+Mobile marker
        for w in wl:
            if str(w.get("CustomerMobile")) == str(user["Mobile"]) and str(w.get("ProductID")) == pid:
                await store.delete_row("Wishlist", "ProductID", pid)
                break
    return {"removed": True}


@api_router.get("/analytics/summary")
async def analytics(user=Depends(owner_only)):
    orders = [norm_order(o) for o in await store.list_rows("Orders")]
    products = [norm_product(p) for p in await store.list_rows("Products")]
    active = [o for o in orders if o["status"] != "Cancelled"]
    delivered = [o for o in orders if o["status"] == "Delivered"]
    revenue = round(sum(o["total"] for o in active), 2)
    profit = round(sum((it.get("rate", 0) - it.get("costRate", 0)) * it.get("qty", 0)
                       for o in delivered for it in o["items"]), 2)
    collected = round(sum(o["total"] for o in active if o["paymentStatus"] == "Paid"), 2)
    pending_amount = round(revenue - collected, 2)
    return {
        "totalRevenue": revenue,
        "netProfit": profit,
        "totalBills": len(active),
        "avgOrderValue": round(revenue / len(active), 2) if active else 0,
        "collected": collected,
        "pendingAmount": pending_amount,
        "statusCounts": {
            "Pending": len([o for o in active if o["status"] == "Pending"]),
            "Shipped": len([o for o in active if o["status"] == "Shipped"]),
            "Delivered": len(delivered),
        },
        "lowStock": [p for p in products if p["stock"] < 10],
        "recentOrders": sorted(active, key=lambda o: o["date"], reverse=True)[:5],
    }


@api_router.get("/setup/status")
async def setup_status(user=Depends(owner_only)):
    connected = False
    if store.mode == "google_sheets":
        try:
            await store.list_rows("Users")
            connected = True
        except HTTPException:
            connected = False
    return {"mode": store.mode, "appsScriptConfigured": bool(APPS_SCRIPT_URL), "connected": connected}


@api_router.get("/setup/apps-script")
async def get_apps_script(user=Depends(owner_only)):
    code_path = ROOT_DIR / "apps_script" / "Code.gs"
    return {"code": code_path.read_text()}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await seed_data()
    except Exception as e:
        logger.error(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
