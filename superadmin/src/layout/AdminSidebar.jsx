import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { NavLink, Stack, Box, Group, Text } from '@mantine/core';
import {
  IconShieldLock,
  IconLayoutDashboard,
  IconBuildingSkyscraper,
  IconArrowLeft,
  IconPackages,
  IconReceipt2,
  IconPalette,
  IconUserShield,
} from '@tabler/icons-react';
import { BrandLogo } from '../components/BrandLogo.jsx';
import { useAuthStore } from '../store/authStore.js';
import { WORKSPACE_URL } from '../utils/paths.js';

const ADMIN_NAV = [
  { label: 'Overview', to: '/', icon: IconLayoutDashboard },
  { label: 'Organizations', to: '/organizations', icon: IconBuildingSkyscraper },
  { label: 'Subscription plans', to: '/plans', icon: IconPackages },
  { label: 'Settlements', to: '/settlements', icon: IconReceipt2 },
  { label: 'Branding', to: '/branding', icon: IconPalette },
  { label: 'Super admins', to: '/super-admins', icon: IconUserShield },
];

export function AdminSidebar({ onNavigate }) {
  const location = useLocation();
  const organization = useAuthStore((s) => s.organization);

  return (
    <Stack h="100%" justify="space-between" p="md" gap={0}>
      <Box>
        <Stack gap={6} mb="xl" pl={4}>
          <BrandLogo height={26} />
          <Group gap={6}>
            <IconShieldLock size={14} />
            <Text fw={700} size="sm" lh={1.1}>Super Admin</Text>
          </Group>
        </Stack>

        <Stack gap={4}>
          {ADMIN_NAV.map((item) => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
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
                onClick={onNavigate}
                styles={{ root: { borderRadius: 8 } }}
              />
            );
          })}
        </Stack>
      </Box>

      {/* Only super admins who also belong to a workspace have one to go back to. */}
      {organization && (
        <NavLink
          label="Back to my workspace"
          leftSection={<IconArrowLeft size={18} stroke={1.75} />}
          component="a"
          href={WORKSPACE_URL}
          styles={{ root: { borderRadius: 8 } }}
        />
      )}
    </Stack>
  );
}
