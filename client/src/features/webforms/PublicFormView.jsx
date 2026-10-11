import { useState } from 'react';
import { Stack, TextInput, Textarea, Button, Text, Title, Alert, ThemeIcon, Box } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useT } from '../../i18n/index.js';

const INPUT_TYPE = { email: 'email', phone: 'tel' };

// Pure presentational form; used both by the public page and the builder's live preview.
export function PublicFormView({ form, onSubmit, submitting, error, done, successMessage, preview = false }) {
  const [values, setValues] = useState({});
  const t = useT();
  const accent = form.accentColor || '#4f4ff0';

  if (done) {
    return (
      <Stack align="center" gap="sm" py="xl">
        <ThemeIcon size={56} radius="xl" color="teal" variant="light"><IconCircleCheck size={32} /></ThemeIcon>
        <Title order={3} ta="center">{t('form.thanks', 'Thank you!')}</Title>
        <Text c="dimmed" ta="center" maw={360}>{successMessage}</Text>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!preview) onSubmit(values);
      }}
    >
      <Stack gap="sm">
        <div>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>{form.title}</Title>
          {form.description && <Text c="dimmed" size="sm" mt={4}>{form.description}</Text>}
        </div>
        {error && <Alert color="red" variant="light">{error}</Alert>}
        {form.fields.map((f) =>
          f.key === 'message' ? (
            <Textarea
              key={f.key}
              label={f.label}
              required={f.required}
              autosize
              minRows={3}
              value={values[f.key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.currentTarget.value }))}
            />
          ) : (
            <TextInput
              key={f.key}
              label={f.label}
              required={f.required}
              type={INPUT_TYPE[f.key] || 'text'}
              value={values[f.key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.currentTarget.value }))}
            />
          ),
        )}
        {/* Honeypot: hidden from humans, bots fill it. */}
        <Box style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
          <input tabIndex={-1} autoComplete="off" name="website" value={values.website || ''} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
        </Box>
        <Button type="submit" size="md" loading={submitting} mt="xs" style={{ background: accent }}>
          {form.submitLabel || 'Submit'}
        </Button>
        <Text size="10px" c="dimmed" ta="center">{t('form.poweredBy', 'Powered by NexusCRM')}</Text>
      </Stack>
    </form>
  );
}
