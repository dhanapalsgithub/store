# Auth Testing Playbook — 3 Star Provisional Store

Auth: mobile + password, bcrypt hashed, PyJWT Bearer token (7-day expiry).
Token stored in localStorage `sps_token`; sent as `Authorization: Bearer <token>`.

## Accounts (seeded at startup)
- Owner: mobile 9000000001 / password admin123 -> redirects to /admin
- Customer: mobile 9000000002 / password user123 -> redirects to /store

## API checks
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"mobile":"9000000001","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Mongo verification (fallback mode)
```
mongosh
use test_database
db.users.find({Role: "Owner"})
db.products.countDocuments()   # should be 45 after seed
```

## Expected behaviours
- Wrong password -> 401 "Invalid mobile number or password"
- 5 failed attempts -> 15-minute lockout (429)
- Owner-only endpoints (/api/products POST/PUT/DELETE, /api/analytics/summary, /api/setup/*) reject customers with 403
- Register with existing mobile -> 400
