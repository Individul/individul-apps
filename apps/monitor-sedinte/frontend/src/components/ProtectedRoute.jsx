import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { checkAuth } from '../api/client';

export default function ProtectedRoute() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    checkAuth().then(ok => setStatus(ok ? 'ok' : 'unauthorized'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
