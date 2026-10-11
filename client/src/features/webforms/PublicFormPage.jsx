import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Box, Paper, Center, Loader, Text } from '@mantine/core';

import { PublicFormView } from './PublicFormView.jsx';
import { API_BASE } from '../../utils/paths.js';

// Hosted public form at /f/:key. `?embed=1` renders a frameless version for iframes.
export function PublicFormPage() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const [done, setDone] = useState(null);

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['public-form', key],
    queryFn: () => axios.get(`${API_BASE}/public/forms/${key}`).then((r) => r.data),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: (values) =>
      axios
        .post(`${API_BASE}/public/forms/${key}/submit`, { ...values, pageUrl: document.referrer || window.location.href })
        .then((r) => r.data),
    onSuccess: (res) => setDone(res.message),
  });

  const body = isLoading ? (
    <Center py="xl"><Loader /></Center>
  ) : isError ? (
    <Text c="dimmed" ta="center" py="xl">This form is no longer available.</Text>
  ) : (
    <PublicFormView
      form={form}
      onSubmit={(v) => submit.mutate(v)}
      submitting={submit.isPending}
      error={submit.error?.response?.data?.message}
      done={Boolean(done)}
      successMessage={done}
    />
  );

  if (embed) return <Box p="md" bg="white" style={{ colorScheme: 'light' }}>{body}</Box>;

  return (
    <Box mih="100vh" py={48} px="md" style={{ background: 'linear-gradient(160deg, #eef0ff 0%, #f7f3ff 100%)', colorScheme: 'light' }}>
      <Paper maw={520} mx="auto" p="xl" radius="lg" shadow="md" bg="white" c="#1a1d29">
        {form && <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">{form.organizationName}</Text>}
        {body}
      </Paper>
    </Box>
  );
}
