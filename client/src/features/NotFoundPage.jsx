import { Center, Stack, Title, Text, Button } from '@mantine/core';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Center h="100vh">
      <Stack align="center" gap="xs">
        <Title order={1}>404</Title>
        <Text c="dimmed">This page doesn't exist.</Text>
        <Button component={Link} to="/" mt="md">
          Back to dashboard
        </Button>
      </Stack>
    </Center>
  );
}
