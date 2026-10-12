import { Box, Flex, Stack, Text, Title, Group, Paper, SimpleGrid, ThemeIcon } from '@mantine/core';
import { BrandLogo } from '../../components/BrandLogo.jsx';
import { IconBolt, IconChartArrowsVertical, IconCalendarEvent, IconShieldCheck } from '@tabler/icons-react';

const FEATURES = [
  { icon: IconChartArrowsVertical, title: 'Pipeline & forecasting', text: 'Kanban deals, weighted forecasts, win-rate tracking' },
  { icon: IconBolt, title: 'Workflow automation', text: 'Auto-assign tasks and alerts the moment things happen' },
  { icon: IconCalendarEvent, title: 'Calendar & tasks', text: 'Meetings, calls and follow-ups in one agenda' },
  { icon: IconShieldCheck, title: 'Enterprise-ready', text: 'Roles, audit log, multi-tenant data isolation' },
];

export function AuthLayout({ children }) {
  return (
    <Flex mih="100vh" style={{ background: 'var(--app-bg)' }}>
      <Flex
        visibleFrom="md"
        w="46%"
        maw={640}
        direction="column"
        justify="space-between"
        p={48}
        style={{
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          background: 'radial-gradient(1200px 600px at -10% -10%, #5f62f5 0%, transparent 55%), radial-gradient(900px 500px at 120% 110%, #a855f7 0%, transparent 50%), #0f1222',
        }}
      >
        <Group gap={10}>
          <BrandLogo height={40} onDark />
        </Group>

        <Stack gap="xl">
          <div>
            <Title order={1} fz={38} fw={800} lh={1.15} style={{ letterSpacing: '-0.03em' }}>
              Close more deals with a CRM your team will actually use.
            </Title>
            <Text c="#b4b9d6" mt="md" size="lg">Sales, support and marketing — one fast, beautiful workspace.</Text>
          </div>

          <SimpleGrid cols={2} spacing="md">
            {FEATURES.map((f) => (
              <Paper
                key={f.title}
                p="md"
                radius="lg"
                withBorder={false}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)' }}
              >
                <ThemeIcon variant="light" color="indigo" radius="md" size={34} mb="xs"><f.icon size={18} /></ThemeIcon>
                <Text fw={700} size="sm" c="white">{f.title}</Text>
                <Text size="xs" c="#9aa0c0" mt={2}>{f.text}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>

        <Text size="xs" c="#6b7193">© {new Date().getFullYear()} Unizova Technologies. All rights reserved.</Text>
      </Flex>

      <Flex flex={1} align="center" justify="center" p="xl">
        <Box w="100%" maw={400}>
          <Group gap={8} mb="xl" hiddenFrom="md">
            <BrandLogo height={36} />
          </Group>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
