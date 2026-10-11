import { useEffect } from 'react';
import { Tabs, Stack } from '@mantine/core';
import {
  IconUsers, IconBuilding, IconUserCircle, IconCreditCard, IconStack2, IconShieldCheck, IconForms, IconPlugConnected,
} from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

import { PageHeader } from '../../components/PageHeader.jsx';
import { TeamTab } from './TeamTab.jsx';
import { OrganizationTab } from './OrganizationTab.jsx';
import { ProfileTab } from './ProfileTab.jsx';
import { BillingTab } from './BillingTab.jsx';
import { PipelineTab } from './PipelineTab.jsx';
import { AuditLogTab } from './AuditLogTab.jsx';
import { CustomFieldsTab } from './CustomFieldsTab.jsx';
import { IntegrationsTab } from './IntegrationsTab.jsx';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

const ADMIN_ROLES = ['owner', 'admin'];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = ADMIN_ROLES.includes(role);
  const billingResult = searchParams.get('billing');
  const activeTab = billingResult ? 'billing' : searchParams.get('tab') || 'team';

  useEffect(() => {
    if (billingResult === 'success') {
      notifications.show({ message: 'Subscription updated successfully', color: 'teal' });
      authApi.me().then(({ user, organization }) => {
        useAuthStore.getState().setSession({ user, organization, accessToken: useAuthStore.getState().accessToken });
      });
    } else if (billingResult === 'cancelled') {
      notifications.show({ message: 'Checkout was cancelled', color: 'gray' });
    }
    if (billingResult) {
      searchParams.delete('billing');
      searchParams.set('tab', 'billing');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTab(tab) {
    setSearchParams({ tab }, { replace: true });
  }

  return (
    <Stack gap="lg">
      <PageHeader title="Settings" subtitle="Manage your team, workspace, pipeline and security" />

      <Tabs value={activeTab} onChange={changeTab} variant="pills" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="team" leftSection={<IconUsers size={16} />}>Team</Tabs.Tab>
          <Tabs.Tab value="organization" leftSection={<IconBuilding size={16} />}>Organization</Tabs.Tab>
          <Tabs.Tab value="pipeline" leftSection={<IconStack2 size={16} />}>Pipeline</Tabs.Tab>
          {isAdmin && <Tabs.Tab value="fields" leftSection={<IconForms size={16} />}>Custom fields</Tabs.Tab>}
          {isAdmin && <Tabs.Tab value="integrations" leftSection={<IconPlugConnected size={16} />}>Integrations</Tabs.Tab>}
          <Tabs.Tab value="billing" leftSection={<IconCreditCard size={16} />}>Billing</Tabs.Tab>
          {isAdmin && <Tabs.Tab value="audit" leftSection={<IconShieldCheck size={16} />}>Audit log</Tabs.Tab>}
          <Tabs.Tab value="profile" leftSection={<IconUserCircle size={16} />}>My profile</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="team"><TeamTab /></Tabs.Panel>
        <Tabs.Panel value="organization"><OrganizationTab /></Tabs.Panel>
        <Tabs.Panel value="pipeline"><PipelineTab /></Tabs.Panel>
        {isAdmin && <Tabs.Panel value="fields"><CustomFieldsTab /></Tabs.Panel>}
        {isAdmin && <Tabs.Panel value="integrations"><IntegrationsTab /></Tabs.Panel>}
        <Tabs.Panel value="billing"><BillingTab /></Tabs.Panel>
        {isAdmin && <Tabs.Panel value="audit"><AuditLogTab /></Tabs.Panel>}
        <Tabs.Panel value="profile"><ProfileTab /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
