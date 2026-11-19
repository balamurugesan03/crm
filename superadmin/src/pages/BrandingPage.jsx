import { useEffect, useState } from 'react';
import {
  Paper, Stack, Group, Text, TextInput, ColorInput, Switch, Button, FileButton, SimpleGrid, Title, Center, Loader, Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconRestore } from '@tabler/icons-react';

import { PageHeader } from '../components/PageHeader.jsx';
import { adminApi, apiError } from '../api/adminApi.js';
import { API_BASE, appPath } from '../utils/paths.js';
import { paletteFromHex } from '../branding/useBranding.js';

const MAX_BYTES = 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/x-icon';

const ASSETS = [
  { kind: 'logo', label: 'Logo (light backgrounds)', hint: 'Admin panel and the mobile login page', fallback: '/unizova-logo.jpeg', bg: '#ffffff' },
  { kind: 'logoDark', label: 'Logo (dark backgrounds)', hint: 'App sidebar and login page. Transparent PNG works best', fallback: '/unilogo-dark.png', bg: '#0f1222' },
  { kind: 'favicon', label: 'Favicon', hint: 'Browser tab icon. Square PNG, 64×64 or larger', fallback: '/favicon.png', bg: '#ffffff' },
];

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// value: undefined = unchanged, null = back to default, string = new image (data URL)
function AssetPicker({ asset, currentUrl, value, onChange }) {
  let preview = currentUrl ? `${API_BASE}${currentUrl}` : appPath(asset.fallback);
  if (value === null) preview = appPath(asset.fallback);
  else if (value) preview = value;
  const isCustom = value === undefined ? Boolean(currentUrl) : Boolean(value);

  async function pick(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notifications.show({ message: 'Image must be 1 MB or smaller', color: 'red' });
      return;
    }
    onChange(await readAsDataUrl(file));
  }

  return (
    <Paper p="md">
      <Stack gap="xs">
        <Text fw={600} size="sm">{asset.label}</Text>
        <Text size="xs" c="dimmed">{asset.hint}</Text>
        <Center h={90} style={{ background: asset.bg, borderRadius: 8, border: '1px solid var(--app-border)' }}>
          <img src={preview} alt={asset.label} style={{ maxHeight: 64, maxWidth: '85%', objectFit: 'contain' }} />
        </Center>
        <Group gap="xs">
          <FileButton onChange={pick} accept={ACCEPT}>
            {(props) => <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />}>Upload</Button>}
          </FileButton>
          {isCustom && (
            <Button size="xs" variant="subtle" color="gray" leftSection={<IconRestore size={14} />} onClick={() => onChange(null)}>
              Use default
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

export function BrandingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-platform-settings'], queryFn: adminApi.getPlatformSettings });
  const [assets, setAssets] = useState({});

  const form = useForm({
    initialValues: { appName: '', companyName: '', tagline: '', primaryColor: '', supportEmail: '', supportPhone: '', allowPublicSignup: false },
    validate: {
      appName: (v) => (v.trim() ? null : 'App name is required'),
      primaryColor: (v) => (!v || /^#[0-9a-f]{6}$/i.test(v) ? null : 'Use a hex colour like #4f46e5'),
      supportEmail: (v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
    },
  });

  useEffect(() => {
    if (!data) return;
    form.setValues({
      appName: data.appName || '',
      companyName: data.companyName || '',
      tagline: data.tagline || '',
      primaryColor: data.primaryColor || '',
      supportEmail: data.supportEmail || '',
      supportPhone: data.supportPhone || '',
      allowPublicSignup: Boolean(data.allowPublicSignup),
    });
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values) => adminApi.updatePlatformSettings({ ...values, ...assets }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-platform-settings'], saved);
      queryClient.setQueryData(['branding'], saved);
      setAssets({});
      notifications.show({ message: 'Branding saved for the whole platform', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not save branding'), color: 'red' }),
  });

  if (isLoading) return <Center h={240}><Loader color="dark" /></Center>;

  const palette = paletteFromHex(form.values.primaryColor);

  return (
    <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
      <PageHeader
        title="Branding"
        subtitle="Name, logo and colours for every workspace, the login page and public forms"
        action={<Button type="submit" loading={mutation.isPending}>Save branding</Button>}
      />

      <Stack gap="lg">
        <Paper p="lg">
          <Title order={4} mb="md">Identity</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="App name" description="Browser tab title and 'Powered by' text" required {...form.getInputProps('appName')} />
            <TextInput label="Company name" description="Footer and logo alt text" {...form.getInputProps('companyName')} />
            <TextInput label="Login page tagline" {...form.getInputProps('tagline')} />
            <div />
            <TextInput label="Support email" description="Shown to customers who need a workspace or are locked out" {...form.getInputProps('supportEmail')} />
            <TextInput label="Support phone" {...form.getInputProps('supportPhone')} />
          </SimpleGrid>
        </Paper>

        <Paper p="lg">
          <Title order={4} mb="md">Theme colour</Title>
          <Group align="flex-end">
            <ColorInput
              label="Primary colour"
              description="Buttons, links, highlights. Empty = default indigo"
              placeholder="#4f4ff0"
              format="hex"
              swatches={['#4f4ff0', '#2563eb', '#0891b2', '#059669', '#16a34a', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#111827']}
              w={280}
              {...form.getInputProps('primaryColor')}
            />
            {form.values.primaryColor && (
              <Button variant="subtle" color="gray" onClick={() => form.setFieldValue('primaryColor', '')}>Reset</Button>
            )}
          </Group>
          {palette && (
            <Group gap={4} mt="md">
              {palette.map((c) => <Box key={c} w={28} h={28} style={{ background: c, borderRadius: 6 }} />)}
            </Group>
          )}
        </Paper>

        <div>
          <Title order={4} mb="md">Logos</Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {ASSETS.map((asset) => (
              <AssetPicker
                key={asset.kind}
                asset={asset}
                currentUrl={data?.[`${asset.kind}Url`]}
                value={assets[asset.kind]}
                onChange={(v) => setAssets((prev) => ({ ...prev, [asset.kind]: v }))}
              />
            ))}
          </SimpleGrid>
          {Object.keys(assets).length > 0 && <Text size="xs" c="orange" mt="xs">Unsaved logo changes. Click Save branding.</Text>}
        </div>

        <Paper p="lg">
          <Title order={4} mb="xs">Access</Title>
          <Switch
            label="Allow public sign-up"
            description="Off: only super admins create organizations (recommended). On: anyone can start a trial workspace from the login page."
            {...form.getInputProps('allowPublicSignup', { type: 'checkbox' })}
          />
        </Paper>
      </Stack>
    </form>
  );
}
