import { Alert, Code, Text } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';

export function AiNotConfigured() {
  return (
    <Alert color="violet" variant="light" icon={<IconSparkles size={18} />} title="Turn on Nexus AI">
      <Text size="sm">
        Add your Anthropic API key to <Code>server/.env</Code> as <Code>ANTHROPIC_API_KEY=...</Code> and restart the server.
        AI summaries, next-best-actions, message drafting, smart search and the Copilot will switch on automatically.
      </Text>
    </Alert>
  );
}
