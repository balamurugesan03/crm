import { NavLink as RouterNavLink, useLocation, useNavigate } from 'react-router-dom';
import { NavLink, Stack, Box, Group, Text } from '@mantine/core';
import { IconShieldLock, IconLayoutDashboard, IconBuildingSkyscraper, IconArrowLeft } from '@tabler/icons-react';
import { BrandLogo } from '../components/BrandLogo.jsx';

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
        <Stack gap={6} mb="xl" pl={4}>
          <BrandLogo height={26} />
          <Group gap={6}>
            <IconShieldLock size={14} />
            <Text fw={700} size="sm" lh={1.1}>Platform Admin</Text>
          </Group>
        </Stack>

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
