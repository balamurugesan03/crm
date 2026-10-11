import { Suspense } from 'react';
import { AppShell, Box, Center, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { useRealtime } from '../realtime/useRealtime.js';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  useRealtime();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
      layout="alt"
    >
      <AppShell.Header withBorder style={{ background: 'var(--app-surface)' }}>
        <Header opened={opened} toggle={toggle} />
      </AppShell.Header>

      <AppShell.Navbar withBorder={false}>
        <Sidebar onNavigate={close} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1480} mx="auto">
          <Suspense
            fallback={
              <Center h={320}>
                <Loader color="indigo" type="dots" />
              </Center>
            }
          >
            <Outlet />
          </Suspense>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
