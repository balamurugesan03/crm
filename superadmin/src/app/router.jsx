import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';

import { AdminLayout } from '../layout/AdminLayout.jsx';
import { AdminRoute, AdminPublicOnlyRoute } from '../layout/AdminRoute.jsx';

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const AdminLoginPage = page(() => import('../pages/AdminLoginPage.jsx'), 'AdminLoginPage');
const AdminDashboardPage = page(() => import('../pages/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const OrganizationsPage = page(() => import('../pages/OrganizationsPage.jsx'), 'OrganizationsPage');
const OrganizationDetailPage = page(() => import('../pages/OrganizationDetailPage.jsx'), 'OrganizationDetailPage');
const PlansPage = page(() => import('../pages/PlansPage.jsx'), 'PlansPage');
const SettlementsPage = page(() => import('../pages/SettlementsPage.jsx'), 'SettlementsPage');
const BrandingPage = page(() => import('../pages/BrandingPage.jsx'), 'BrandingPage');
const SuperAdminsPage = page(() => import('../pages/SuperAdminsPage.jsx'), 'SuperAdminsPage');

export function AppRouter() {
  return (
    <Suspense fallback={<Center h={320}><Loader color="dark" type="dots" /></Center>}>
      <Routes>
        <Route path="/login" element={<AdminPublicOnlyRoute><AdminLoginPage /></AdminPublicOnlyRoute>} />
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="branding" element={<BrandingPage />} />
          <Route path="super-admins" element={<SuperAdminsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
