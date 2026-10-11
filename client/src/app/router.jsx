import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';

import { AppLayout } from '../layout/AppLayout.jsx';
import { ProtectedRoute } from '../layout/ProtectedRoute.jsx';
import { PublicOnlyRoute } from '../layout/PublicOnlyRoute.jsx';
import { AdminLayout } from '../layout/AdminLayout.jsx';
import { AdminRoute } from '../layout/AdminRoute.jsx';

// Route-level code splitting: each page is its own chunk.
const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const LoginPage = page(() => import('../features/auth/LoginPage.jsx'), 'LoginPage');
const SignupPage = page(() => import('../features/auth/SignupPage.jsx'), 'SignupPage');
const DashboardPage = page(() => import('../features/dashboard/DashboardPage.jsx'), 'DashboardPage');
const ContactsPage = page(() => import('../features/contacts/ContactsPage.jsx'), 'ContactsPage');
const ContactDetailPage = page(() => import('../features/contacts/ContactDetailPage.jsx'), 'ContactDetailPage');
const CompaniesPage = page(() => import('../features/companies/CompaniesPage.jsx'), 'CompaniesPage');
const CompanyDetailPage = page(() => import('../features/companies/CompanyDetailPage.jsx'), 'CompanyDetailPage');
const LeadsPage = page(() => import('../features/leads/LeadsPage.jsx'), 'LeadsPage');
const DealsPage = page(() => import('../features/deals/DealsPage.jsx'), 'DealsPage');
const TasksPage = page(() => import('../features/tasks/TasksPage.jsx'), 'TasksPage');
const CalendarPage = page(() => import('../features/calendar/CalendarPage.jsx'), 'CalendarPage');
const SettingsPage = page(() => import('../features/settings/SettingsPage.jsx'), 'SettingsPage');
const ProductsPage = page(() => import('../features/products/ProductsPage.jsx'), 'ProductsPage');
const QuotesPage = page(() => import('../features/quotes/QuotesPage.jsx'), 'QuotesPage');
const InvoicesPage = page(() => import('../features/invoices/InvoicesPage.jsx'), 'InvoicesPage');
const ReportsPage = page(() => import('../features/reports/ReportsPage.jsx'), 'ReportsPage');
const TicketsPage = page(() => import('../features/tickets/TicketsPage.jsx'), 'TicketsPage');
const CampaignsPage = page(() => import('../features/campaigns/CampaignsPage.jsx'), 'CampaignsPage');
const CampaignDetailPage = page(() => import('../features/campaigns/CampaignDetailPage.jsx'), 'CampaignDetailPage');
const TargetsPage = page(() => import('../features/targets/TargetsPage.jsx'), 'TargetsPage');
const WebFormsPage = page(() => import('../features/webforms/WebFormsPage.jsx'), 'WebFormsPage');
const PublicFormPage = page(() => import('../features/webforms/PublicFormPage.jsx'), 'PublicFormPage');
const PortalPage = page(() => import('../features/portal/PortalPage.jsx'), 'PortalPage');
const ReceivablesPage = page(() => import('../features/finance/ReceivablesPage.jsx'), 'ReceivablesPage');
const GstReturnsPage = page(() => import('../features/finance/GstReturnsPage.jsx'), 'GstReturnsPage');
const AutomationsPage = page(() => import('../features/automations/AutomationsPage.jsx'), 'AutomationsPage');
const PrintDocumentPage = page(() => import('../features/print/PrintDocumentPage.jsx'), 'PrintDocumentPage');
const AdminDashboardPage = page(() => import('../features/admin/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const OrganizationsPage = page(() => import('../features/admin/OrganizationsPage.jsx'), 'OrganizationsPage');
const OrganizationDetailPage = page(() => import('../features/admin/OrganizationDetailPage.jsx'), 'OrganizationDetailPage');
const NotFoundPage = page(() => import('../features/NotFoundPage.jsx'), 'NotFoundPage');

export function PageLoader() {
  return (
    <Center h={320}>
      <Loader color="indigo" type="dots" />
    </Center>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
        <Route path="/f/:key" element={<PublicFormPage />} />
        <Route path="/portal" element={<PortalPage />} />
        <Route path="/print/:type/:id" element={<ProtectedRoute><PrintDocumentPage /></ProtectedRoute>} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="companies/:id" element={<CompanyDetailPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="web-forms" element={<WebFormsPage />} />
          <Route path="receivables" element={<ReceivablesPage />} />
          <Route path="gst-returns" element={<GstReturnsPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
