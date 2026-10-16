import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import EntitiesPage from "./pages/EntitiesPage";
import EntityDetailPage from "./pages/EntityDetailPage";

function Nav() {
  const location = useLocation();
  const linkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      location.pathname === path
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          LedgerMind
        </Link>
        <div className="flex gap-2">
          <Link to="/" className={linkClass("/")}>
            Upload
          </Link>
          <Link to="/entities" className={linkClass("/entities")}>
            Entities
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/entities/:id" element={<EntityDetailPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}