import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Sedinte from './pages/Sedinte';
import Persoane from './pages/Persoane';
import Setari from './pages/Setari';
import Calendar from './pages/Calendar';
import Hotarari from './pages/Hotarari';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter basename="/monitor">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sedinte" element={<Sedinte />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/persoane" element={<Persoane />} />
            <Route path="/hotarari" element={<Hotarari />} />
            <Route path="/setari" element={<Setari />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
