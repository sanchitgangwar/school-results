import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Code-splitting: Load pages dynamically
const LoginPage = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PublicReportCard = lazy(() => import('./pages/PublicReportCard'));
const QRCodePrintView = lazy(() => import('./pages/QRCodePrintView'));

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
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
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
      </Suspense>
    </Router>
  );
};

export default App;