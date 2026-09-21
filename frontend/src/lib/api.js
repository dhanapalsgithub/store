import axios from "axios";

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

// DIRECT GOOGLE APPS SCRIPT URL
const backendUrl = "https://script.google.com/macros/s/AKfycbwhZ4xi2nchFEicODoHBVK4ADZWHQMmYqUHXgxMQjKIH2sQbDdDfJRZpKoA6mzBTvjdpA/exec";

// Resilient GET & POST request function for Google Apps Script
export const appsScriptRequest = async (payload, method = "GET") => {
  try {
    let url = backendUrl;
    let options = {
      method: method,
      redirect: "follow",
    };

    if (method === "POST") {
      options.headers = { "Content-Type": "text/plain;charset=utf-8" };
      options.body = JSON.stringify(payload);
    } else {
      const queryParam = encodeURIComponent(JSON.stringify(payload || {}));
      url += `?data=${queryParam}`;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    if (result && result.ok === false) {
      throw new Error(result.error || "Google Apps Script returned an error.");
    }
    return result;
  } catch (err) {
    console.error("Apps Script request failed:", err);
    throw new Error(err.message || "Unable to connect to Google Apps Script.");
  }
};

// Axios Instance with Automatic Google Sheet Header Normalization
const api = axios.create({
  baseURL: backendUrl,
  adapter: async (config) => {
    try {
      const method = (config.method || "get").toUpperCase();
      let payload = {};

      if (config.data) {
        payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      } else if (config.params) {
        payload = config.params;
      }

      const url = config.url || "";

      // 1. பயனர் உள்நுழைவுத் தகவலைச் சரிபார்த்தல் (User Authentication Check)
      if (url.includes("/auth/me")) {
        const savedUser = localStorage.getItem("sps_user");
        const userObj = savedUser ? JSON.parse(savedUser) : null;
        return {
          data: userObj ? { ok: true, user: userObj, ...userObj } : { ok: false, user: null },
          status: 200,
          statusText: "OK",
          headers: config.headers,
          config,
        };
      }

      // Handle Analytics Summary endpoint for dashboard Overview.jsx cards
      if (url.includes("/analytics/summary") || url.includes("/summary")) {
        const rawData = await appsScriptRequest({ action: "getAnalytics", sheet: "analytics" }, "GET");
        return {
          data: rawData.data || rawData,
          status: 200,
          statusText: "OK",
          headers: config.headers,
          config,
        };
      }

      // 2. ஷீட் பெயர்களை இணைத்தல் (Map Endpoints to Sheet Names)
      let targetSheet = "Products";
      if (url.includes("/orders") || url.includes("/payments")) targetSheet = "Orders";
      else if (url.includes("/wishlist")) targetSheet = "Wishlist";
      else if (url.includes("/purchases")) targetSheet = "Purchases";
      else if (url.includes("/partypayments") || url.includes("/party-payments")) targetSheet = "PartyPayments";

      // POST அல்லது PUT முறையானது டேட்டாவைச் சேமிக்க அல்லது மாற்ற பயன்படுகிறது
      if (method === "POST" || method === "PUT") {
        if (!payload.action) {
          const innerRow = payload.row || payload;

          if (targetSheet === "Wishlist") {
            const savedUser = localStorage.getItem("sps_user");
            const userObj = savedUser ? JSON.parse(savedUser) : null;

            payload = {
              action: "insert",
              sheet: "Wishlist",
              row: {
                CustomerMobile: userObj?.mobile || userObj?.phone || "Guest",
                ProductID: innerRow.ProductsID || innerRow.id || innerRow.ProductID
              }
            };
          } else if (targetSheet === "Products") {
            // Products-க்கான முறை (Add / Update Product)
            const productId = url.split("/").pop() !== "products" ? url.split("/").pop() : (innerRow.ProductsID || innerRow.id || "PROD" + Date.now());

            payload = {
              action: method === "PUT" ? "update" : "insert",
              sheet: "Products",
              key: "Products ID",
              value: productId,
              row: {
                "Products ID": productId,
                products: innerRow.productName || innerRow.name || innerRow.products || "",
                Category: innerRow.category || innerRow.Category || "Attai",
                "Wholesale Price": Number(innerRow.wholesaleRate !== undefined ? innerRow.wholesaleRate : innerRow["Wholesale Price"] || 0),
                "Retail Price": Number(innerRow.rate !== undefined ? innerRow.rate : innerRow["Retail Price"] || 0),
                Unit: innerRow.unit || innerRow.Unit || "1 kg",
                Stock: Number(innerRow.stockQty !== undefined ? innerRow.stockQty : innerRow.stock || 0),
                Sales: Number(innerRow.sales || 0),
                image: innerRow.image || "",
                Status: innerRow.status || "Active",
                "Purchase Price": Number(innerRow.costRate !== undefined ? innerRow.costRate : innerRow["Purchase Price"] || 0)
              },
              targetRow: {
                id: productId,
                ProductsID: productId,
                name: innerRow.productName || innerRow.name || "",
                category: innerRow.category || innerRow.Category || "Attai",
                wholesaleRate: Number(innerRow.wholesaleRate || 0),
                rate: Number(innerRow.rate || 0),
                costRate: Number(innerRow.costRate || 0),
                stock: Number(innerRow.stockQty !== undefined ? innerRow.stockQty : innerRow.stock || 0),
                unit: innerRow.unit || "1 kg",
                image: innerRow.image || ""
              }
            };
          } else if (targetSheet === "Purchases") {
            // Purchases-க்கான முறை (Add Purchase)
            payload = {
              action: "insert",
              sheet: "Purchases",
              row: {
                eNo: innerRow.purchaseNo || innerRow.eNo || "PUR-" + Date.now().toString().slice(-6),
                purchaseDate: innerRow.date || innerRow.purchaseDate || new Date().toISOString().split('T')[0],
                supplierName: innerRow.supplier || innerRow.supplierName || "",
                invoiceNo: innerRow.invoiceNo || innerRow.invoice || "",
                "item.name": innerRow.itemName || innerRow.name || "",
                "item.qty": Number(innerRow.qty || 0),
                "item.pRate": Number(innerRow.pRate || 0),
                "item.salesRate": Number(innerRow.salesRate || 0),
                "item.mrp": Number(innerRow.mrp || 0),
                "item.total": Number(innerRow.total || (Number(innerRow.qty || 0) * Number(innerRow.pRate || 0))),
                paymentDetails: innerRow.paymentDetails || ""
              }
            };
          } else if (targetSheet === "PartyPayments") {
            const totalAmt = Number(innerRow.totalAmount || innerRow.total || 0);
            const paidAmt = Number(innerRow.paidAmount || innerRow.amount || 0);
            
            payload = {
              action: "insert",
              sheet: "PartyPayments",
              row: {
                "Purchase No": innerRow.purchaseNo || innerRow.paymentId || "PAY-" + Date.now().toString().slice(-6),
                "Supplier Name": innerRow.supplierName || innerRow.partyName || "",
                "Total Amount": totalAmt,
                "Paid Amount": paidAmt,
                "Balance": totalAmt - paidAmt,
                "Payment Mode": innerRow.paymentMode || innerRow.mode || "Cash",
                "Date": innerRow.date || new Date().toISOString().split('T')[0]
              }
            };
          } else {
            // ஆர்டர்களுக்கான முறை (Orders)
            const mobile = innerRow.CustomerMobile || innerRow.mobile || innerRow.phone || "N/A";
            const name = innerRow.CustomerName || innerRow.name || "Customer";
            const address = innerRow.Address || innerRow.address || "";
            const items = innerRow.ItemsJSON || innerRow.items || [];
            const total = innerRow.TotalAmount || innerRow.total || 0;

            payload = {
              action: "insert",
              sheet: "Orders",
              row: {
                OrderID: innerRow.OrderID || innerRow.id || "ORD-" + Date.now().toString().slice(-6),
                CustomerMobile: mobile,
                CustomerName: name,
                ItemsJSON: typeof items === "string" ? items : JSON.stringify(items),
                TotalAmount: total,
                PaymentStatus: innerRow.PaymentStatus || innerRow.paymentStatus || "Pending",
                PaymentMethod: innerRow.PaymentMethod || innerRow.paymentMethod || "Cash on Delivery",
                Date: innerRow.Date || new Date().toISOString(),
                Status: innerRow.Status || "Pending",
                Address: address
              }
            };
          }
        }
      } else if (method === "DELETE" || (method === "POST" && payload.action === "delete")) {
        const deleteId = payload.id || url.split("/").pop();
        payload = {
          action: "delete",
          sheet: targetSheet,
          key: targetSheet === "Products" ? "Products ID" : (targetSheet === "PartyPayments" ? "paymentId" : "ProductID"),
          value: deleteId
        };
      } else {
        payload = { action: "read", sheet: targetSheet, ...payload };
      }

      const rawData = await appsScriptRequest(payload, method === "DELETE" ? "POST" : (method === "PUT" ? "POST" : method));

      // 3. டேட்டாவைச் சரிசெய்து அனுப்புதல் (Format Data for React UI)
      let formattedData = rawData;
      if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
        if (rawData.data && Array.isArray(rawData.data)) {
          formattedData = rawData.data;
        } else if (rawData.products && Array.isArray(rawData.products)) {
          formattedData = rawData.products;
        } else if (rawData.items && Array.isArray(rawData.items)) {
          formattedData = rawData.items;
        } else if (method === "POST" || method === "PUT") {
          formattedData = payload.targetRow || payload.row || rawData.data || {};
        }
      }

      // Products டேட்டாவை சீராக ஃபார்மட் செய்தல் (Google Sheet Spaces mapping fix)
      if (targetSheet === "Products" && Array.isArray(formattedData)) {
        formattedData = formattedData.map((p) => ({
          ...p,
          id: p["Products ID"] || p.ProductsID || p.id || "",
          ProductsID: p["Products ID"] || p.ProductsID || p.id || "",
          name: p.products || p.name || "",
          products: p.products || p.name || "",
          Category: p.Category || p.category || "",
          category: p.Category || p.category || "",
          "Retail Price": Number(p["Retail Price"] || p.rate || p.price || 0),
          rate: Number(p["Retail Price"] || p.rate || p.price || 0),
          "Wholesale Price": Number(p["Wholesale Price"] || p.wholesaleRate || 0),
          wholesaleRate: Number(p["Wholesale Price"] || p.wholesaleRate || 0),
          costRate: Number(p["Purchase Price"] || p.costRate || 0),
          Stock: Number(p["Stock"] !== undefined ? p["Stock"] : (p.stock !== undefined ? p.stock : 0)),
          stock: Number(p["Stock"] !== undefined ? p["Stock"] : (p.stock !== undefined ? p.stock : 0)),
          Unit: p.Unit || p.unit || "",
          unit: p.Unit || p.unit || "",
          image: p.image || ""
        }));
      }

      return {
        data: formattedData,
        status: 200,
        statusText: "OK",
        headers: config.headers,
        config,
      };
    } catch (error) {
      return {
        data: { ok: false, error: error.message },
        status: 200,
        statusText: "OK",
        headers: config.headers,
        config,
      };
    }
  }
});

export const errMsg = (e) => {
  if (typeof e === "string") return e;
  const d = e?.response?.data?.detail || e?.response?.data?.error;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || "").join(" ");
  return e?.message || "Something went wrong";
};

export const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const CATEGORIES = [
  { id: "Attai", tamil: "அட்டை மாவு வகைகள்", english: "Attai (Flours)" },
  { id: "Saram", tamil: "சரம் பொருட்கள்", english: "Saram (Provisions & Grains)" },
  { id: "Loose Pack", tamil: "லூஸ் பேக் பொருட்கள்", english: "Loose Pack Items" },
];

export const catBadge = (cat) =>
  cat === "Attai"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : cat === "Saram"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-blue-100 text-blue-800 border-blue-200";

export const statusBadge = (s) =>
  s === "Delivered"
    ? "bg-emerald-100 text-emerald-700"
    : s === "Shipped"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

export const STORE_WHATSAPP = "919941669513";

export const waOrderLink = (order, user) => {
  const lines = (order.items || []).map((it) => `- ${it.name || it.products || "Item"} x ${it.qty || 1} = Rs.${((it.rate || it.price || 0) * (it.qty || 1)).toFixed(2)}`).join("\n");
  const msg = [
    "New Order - 3 Star Grocery Store",
    `Order ID: ${order.id}`,
    `Name: ${user?.name || order.customerName || ""}`,
    `Mobile: ${user?.mobile || order.customerMobile || ""}`,
    "",
    lines,
    "",
    `Total: Rs.${order.total}`,
    `Payment: ${order.paymentMethod || "Cash on Delivery"} (${order.paymentStatus || "Unpaid"})`,
    `Address: ${order.address || ""}`,
  ].join("\n");
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
};

export default api;