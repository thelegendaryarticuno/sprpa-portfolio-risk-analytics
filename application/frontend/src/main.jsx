import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, PortfolioProvider, useAuth } from "./state";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Shell from "./pages/Shell";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Risk from "./pages/Risk";

// Mount portfolio state only once signed in, so /api calls always carry a token.
function Protected() {
  const { user } = useAuth();
  if (user === undefined) return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <PortfolioProvider><Shell /></PortfolioProvider>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<Protected />}>
            <Route index element={<Dashboard />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="risk" element={<Risk />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
