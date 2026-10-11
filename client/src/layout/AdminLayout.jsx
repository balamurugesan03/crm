import { Suspense } from 'react';
import { AppShell, Group, Text, Menu, Avatar, UnstyledButton, Burger } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate } from 'react-router-dom';
import { IconChevronDown, IconLogout } from '@tabler/icons-react';

import { AdminSidebar } from './AdminSidebar.jsx';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';

export function AdminLayout() {
  const [opened, { toggle }] = useDisclosure(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header withBorder>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={600} size="sm" c="dimmed">Platform-wide view — spans all organizations</Text>
          </Group>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group gap={8}>
                  <Avatar color="dark" radius="xl" size={32}>{user?.name?.[0]?.toUpperCase()}</Avatar>
                  <Text size="sm" fw={500}>{user?.name}</Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={handleLogout}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar withBorder>
        <AdminSidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <Suspense fallback={null}><Outlet /></Suspense>
      </AppShell.Main>
    </AppShell>
  );
}
