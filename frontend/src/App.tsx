import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import EntitiesPage from "./pages/EntitiesPage";
import EntityDetailPage from "./pages/EntityDetailPage";
import TransactionsPage from "./pages/TransactionsPage";
import AccountsPage from "./pages/AccountsPage";


export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/entities/:id" element={<EntityDetailPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}