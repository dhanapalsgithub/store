import { useState } from "react";
import { LayoutDashboard, Package, ClipboardList, Receipt, Sheet } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Overview from "@/components/admin/Overview";
import Inventory from "@/components/admin/Inventory";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminTransactions from "@/components/admin/AdminTransactions";
import SheetsSetup from "@/components/admin/SheetsSetup";

const TABS = [
  { id: "overview", label: "Analytics", icon: <LayoutDashboard size={14} /> },
  { id: "inventory", label: "Rates & Inventory", icon: <Package size={14} /> },
  { id: "orders", label: "Orders", icon: <ClipboardList size={14} /> },
  { id: "transactions", label: "Transactions", icon: <Receipt size={14} /> },
  { id: "setup", label: "Sheets Sync", icon: <Sheet size={14} /> },
];

export default function Admin() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="min-h-screen bg-[#fdfbf7]" data-testid="admin-dashboard">
      <Header tabs={TABS} active={tab} onTab={setTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "overview" && <Overview />}
        {tab === "inventory" && <Inventory />}
        {tab === "orders" && <AdminOrders />}
        {tab === "transactions" && <AdminTransactions />}
        {tab === "setup" && <SheetsSetup />}
      </main>
      <Footer />
    </div>
  );
}
