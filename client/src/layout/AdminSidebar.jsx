import { NavLink as RouterNavLink, useLocation, useNavigate } from 'react-router-dom';
import { NavLink, Stack, Box, Group, Text, ThemeIcon } from '@mantine/core';
import { IconShieldLock, IconLayoutDashboard, IconBuildingSkyscraper, IconArrowLeft } from '@tabler/icons-react';

const ADMIN_NAV = [
  { label: 'Overview', to: '/admin', icon: IconLayoutDashboard },
  { label: 'Organizations', to: '/admin/organizations', icon: IconBuildingSkyscraper },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Stack h="100%" justify="space-between" p="md" gap={0}>
      <Box>
        <Group gap={8} mb="xl" pl={4}>
          <ThemeIcon size={32} radius="md" variant="filled" color="dark">
            <IconShieldLock size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="sm" lh={1.1}>Platform Admin</Text>
            <Text size="xs" c="dimmed">NexusCRM</Text>
          </div>
        </Group>

        <Stack gap={4}>
          {ADMIN_NAV.map((item) => {
            const active = item.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                component={RouterNavLink}
                to={item.to}
                label={item.label}
                leftSection={<item.icon size={18} stroke={1.75} />}
                active={active}
                variant="filled"
                color="dark"
                styles={{ root: { borderRadius: 8 } }}
              />
            );
          })}
        </Stack>
      </Box>

      <NavLink
        label="Back to my workspace"
        leftSection={<IconArrowLeft size={18} stroke={1.75} />}
        onClick={() => navigate('/')}
        styles={{ root: { borderRadius: 8 } }}
      />
    </Stack>
  );
}
