import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { MyListProvider } from './context/MyListContext';

import Home from '@/pages/Home';
import Browse from '@/pages/Browse';
import Auth from '@/pages/Auth';
import Upload from '@/pages/admin/Upload';
import Manage from '@/pages/admin/Manage';
import Profile from '@/pages/user/Profile';
import Watch from '@/pages/Watch';

function App() {
  return (
    <AuthProvider>
      <MyListProvider>
        <Router>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/auth" element={<Auth />} />

            {/* Watch (PROTECTED for logged-in users) */}
            <Route
              path="/watch/:id"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <Watch />
                </ProtectedRoute>
              }
            />

            {/* User Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/watchlist"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/upload"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Upload />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/manage"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Manage />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="text-white text-center pt-40">
                  404 - Page Not Found
                </div>
              }
            />
          </Routes>

          <AuthModal />
          <Toaster position="bottom-right" theme="dark" />
        </Router>
      </MyListProvider>
    </AuthProvider>
  );
}

export default App;
