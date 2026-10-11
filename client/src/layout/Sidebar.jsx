import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { Stack, Box, Group, Text, ScrollArea, Avatar, Badge } from '@mantine/core';
import { IconStack3 } from '@tabler/icons-react';
import { navSections, bottomNavItems } from './navItems.js';
import { useAuthStore } from '../store/authStore.js';
import { useT } from '../i18n/index.js';

function SidebarLink({ item, active, onNavigate }) {
  const t = useT();
  return (
    <RouterNavLink to={item.to} className="sidebar-link" data-active={active} onClick={onNavigate}>
      <item.icon size={18} stroke={1.7} />
      <span>{t(`nav.${item.label}`, item.label)}</span>
    </RouterNavLink>
  );
}

function isActive(item, pathname) {
  return item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
}

export function Sidebar({ onNavigate }) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const t = useT();

  return (
    <Stack h="100%" justify="space-between" gap={0} className="sidebar">
      <Box style={{ minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Group gap={10} px="md" h={64} wrap="nowrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Box className="brand-mark" w={34} h={34} style={{ borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <IconStack3 size={19} color="white" />
          </Box>
          <div style={{ lineHeight: 1.15 }}>
            <Text fw={800} size="md" c="white" style={{ letterSpacing: '-0.01em' }}>NexusCRM</Text>
            <Text size="xs" c="#6b7193" truncate maw={160}>{organization?.name}</Text>
          </div>
        </Group>

        <ScrollArea style={{ flex: 1 }} px="sm" py="md" scrollbarSize={6}>
          <Stack gap="md">
            {navSections.map((section) => (
              <Stack gap={2} key={section.label}>
                <div className="sidebar-section-label">{t(`nav.${section.label}`, section.label)}</div>
                {section.items.map((item) => (
                  <SidebarLink key={item.to} item={item} active={isActive(item, pathname)} onNavigate={onNavigate} />
                ))}
              </Stack>
            ))}
          </Stack>
        </ScrollArea>
      </Box>

      <Stack gap={2} px="sm" pb="sm">
        {bottomNavItems.map((item) => (
          <SidebarLink key={item.to} item={item} active={isActive(item, pathname)} onNavigate={onNavigate} />
        ))}
        <Group
          gap={10}
          mt="xs"
          p={10}
          wrap="nowrap"
          style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Avatar color={user?.avatarColor || 'indigo'} radius="xl" size={32} variant="filled">
            {user?.name?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
            <Text size="sm" fw={600} c="white" truncate>{user?.name}</Text>
            <Text size="xs" c="#6b7193" truncate>{user?.email}</Text>
          </div>
          <Badge size="xs" variant="light" color="indigo" tt="capitalize">{organization?.plan || 'trial'}</Badge>
        </Group>
      </Stack>
    </Stack>
  );
}
