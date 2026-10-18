import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { Toasts } from "./components/Toasts";
import { Banners } from "./components/Banners";
import { Ticker } from "./components/Ticker";
import { useMedia } from "./lib/useMedia";
import Landing from "./pages/Landing";
import Exchange from "./pages/Exchange";
import Ledger from "./pages/Ledger";
import Connect from "./pages/Connect";
import Director from "./pages/Director";
import MerchantApp from "./pages/Merchant";
import PhoneApp from "./pages/Phone";

export default function App() {
  const loc = useLocation();
  const desktop = useMedia("(min-width: 1024px)");
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  const landing = path === "/";
  const mobileApp = path.startsWith("/merchant") || path.startsWith("/phone");
  const isExchange = path === "/exchange" || path === "/live";
  const chrome = !landing && (!mobileApp || desktop);

  return (
    <div className="app-backdrop relative min-h-screen">
      {chrome && <TopBar />}
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/live" element={<Exchange />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/director" element={<Director />} />
          <Route path="/merchant" element={<MerchantApp />} />
          <Route path="/phone" element={<PhoneApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!landing && !mobileApp && (
        <>
          <Banners top={56} />
          <Toasts bottom={isExchange ? 56 : 20} />
        </>
      )}
      {isExchange && <Ticker />}
    </div>
  );
}
