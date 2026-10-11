import {
  Group, Text, Menu, Avatar, UnstyledButton, Burger, TextInput, Kbd, ActionIcon, Tooltip, Button,
  useMantineColorScheme, useComputedColorScheme,
} from '@mantine/core';
import {
  IconChevronDown, IconLogout, IconUserCircle, IconShieldLock, IconSearch, IconSun, IconMoon, IconPlus,
  IconUsers, IconTargetArrow, IconStack2, IconChecklist, IconCalendarPlus, IconHeadset, IconSettings, IconSparkles, IconLanguage,
} from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';
import { GlobalSearch } from '../features/search/GlobalSearch.jsx';
import { NotificationBell } from '../features/notifications/NotificationBell.jsx';
import { CopilotDrawer } from '../features/ai/CopilotDrawer.jsx';
import { navSections, bottomNavItems } from './navItems.js';
import { useT, useLangStore, LANGUAGES } from '../i18n/index.js';

const QUICK_CREATE = [
  { label: 'Lead', icon: IconTargetArrow, to: '/leads?new=1' },
  { label: 'Deal', icon: IconStack2, to: '/deals?new=1' },
  { label: 'Contact', icon: IconUsers, to: '/contacts?new=1' },
  { label: 'Task', icon: IconChecklist, to: '/tasks?new=1' },
  { label: 'Meeting', icon: IconCalendarPlus, to: '/calendar?new=1' },
  { label: 'Ticket', icon: IconHeadset, to: '/tickets?new=1' },
];

function currentPageLabel(pathname) {
  const all = [...navSections.flatMap((s) => s.items), ...bottomNavItems];
  const match = all
    .filter((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label || '';
}

export function Header({ opened, toggle }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [searchOpened, setSearchOpened] = useState(false);
  const [copilotOpened, setCopilotOpened] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  useHotkeys([
    ['mod+K', () => setSearchOpened(true)],
    ['mod+I', () => setCopilotOpened((o) => !o)],
    ['mod+J', () => setColorScheme(scheme === 'dark' ? 'light' : 'dark')],
  ]);

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
      <Group wrap="nowrap" gap="sm">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <TextInput
          placeholder={t('header.search', 'Search records…')}
          leftSection={<IconSearch size={16} />}
          rightSection={<Kbd size="xs">Ctrl K</Kbd>}
          rightSectionWidth={62}
          w={340}
          visibleFrom="md"
          readOnly
          onClick={() => setSearchOpened(true)}
          styles={{ input: { cursor: 'pointer', background: 'var(--app-subtle)' } }}
        />
        <Text fw={700} size="lg" hiddenFrom="md">{t(`nav.${currentPageLabel(pathname)}`, currentPageLabel(pathname))}</Text>
      </Group>

      <Group wrap="nowrap" gap="xs">
        <ActionIcon variant="default" size="lg" hiddenFrom="md" onClick={() => setSearchOpened(true)} aria-label="Search">
          <IconSearch size={18} />
        </ActionIcon>

        <Menu position="bottom-end" width={200}>
          <Menu.Target>
            <Button leftSection={<IconPlus size={16} />} size="sm" variant="gradient" gradient={{ from: 'indigo.6', to: 'violet.5', deg: 135 }} visibleFrom="sm">
              {t('header.create', 'Create')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('header.quickCreate', 'Quick create')}</Menu.Label>
            {QUICK_CREATE.map((q) => (
              <Menu.Item key={q.label} leftSection={<q.icon size={16} />} onClick={() => navigate(q.to)}>
                {t(`create.${q.label}`, q.label)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        <Tooltip label="Nexus AI Copilot (Ctrl I)">
          <Button
            variant="light"
            color="grape"
            size="sm"
            leftSection={<IconSparkles size={16} />}
            onClick={() => setCopilotOpened(true)}
            visibleFrom="xs"
          >
            {t('header.askAi', 'Ask AI')}
          </Button>
        </Tooltip>

        <Tooltip label={scheme === 'dark' ? 'Light mode (Ctrl J)' : 'Dark mode (Ctrl J)'}>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle color scheme"
          >
            {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Tooltip>

        <NotificationBell />

        <Menu width={220} position="bottom-end">
          <Menu.Target>
            <UnstyledButton aria-label="Account menu">
              <Group gap={6} wrap="nowrap">
                <Avatar color={user?.avatarColor || 'indigo'} radius="xl" size={34} variant="filled">
                  {user?.name?.[0]?.toUpperCase()}
                </Avatar>
                <IconChevronDown size={14} />
              </Group>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              <Text size="sm" fw={600} c="var(--mantine-color-text)">{user?.name}</Text>
              <Text size="xs" c="dimmed" tt="capitalize">{user?.role?.replace('_', ' ')}</Text>
            </Menu.Label>
            <Menu.Divider />
            <Menu.Item leftSection={<IconUserCircle size={16} />} onClick={() => navigate('/settings?tab=profile')}>
              {t('header.myProfile', 'My profile')}
            </Menu.Item>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigate('/settings')}>
              {t('header.settings', 'Settings')}
            </Menu.Item>
            <Menu.Label>{t('header.language', 'Language')}</Menu.Label>
            {LANGUAGES.map((l) => (
              <Menu.Item key={l.value} leftSection={<IconLanguage size={16} />} onClick={() => setLang(l.value)} fw={lang === l.value ? 700 : 400}>
                {l.label}{lang === l.value ? ' ✓' : ''}
              </Menu.Item>
            ))}
            {user?.isSuperAdmin && (
              <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={() => navigate('/admin')}>
                {t('header.platformAdmin', 'Platform admin')}
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={handleLogout}>
              {t('header.logout', 'Log out')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <GlobalSearch opened={searchOpened} onClose={() => setSearchOpened(false)} />
      <CopilotDrawer opened={copilotOpened} onClose={() => setCopilotOpened(false)} />
    </Group>
  );
}
