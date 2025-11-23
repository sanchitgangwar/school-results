import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import PublicReportCard from './pages/PublicReportCard';
import QRCodePrintView from './pages/QRCodePrintView';

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is already logged in (persist session)
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('userData');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/* Public Route: Student Result Link */}
        <Route path="/student/:token" element={<PublicReportCard />} />

        {/* Auth Route: Login */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />
        } />

        {/* Protected Route: Dashboard */}
        <Route path="/dashboard" element={
          user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />

        {/* Protected Route: QR Code Print */}
        <Route path="/print-qrs/:schoolId" element={<QRCodePrintView />} />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;