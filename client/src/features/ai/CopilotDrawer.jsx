import { useEffect, useRef, useState } from 'react';
import {
  Drawer, Stack, Group, Text, Textarea, ActionIcon, Paper, ThemeIcon, Badge, ScrollArea, Button, Loader, Tooltip, Box,
  TypographyStylesProvider,
} from '@mantine/core';
import { IconSparkles, IconSend, IconPlayerStop, IconTrash, IconSearch, IconDatabase, IconChartBar } from '@tabler/icons-react';

import { aiApi } from '../../api/aiApi.js';
import { useAiStatus } from './useAiStatus.js';
import { AiNotConfigured } from './AiNotConfigured.jsx';
import { useAuthStore } from '../../store/authStore.js';

const SUGGESTIONS = [
  'How is my pipeline looking this month?',
  'Which deals above ₹5L are stuck and need attention?',
  'Show my overdue tasks and what to do first',
  'Top 5 hot leads I should call today',
  'Indha month close aagura deals list pannu',
];

const TOOL_LABEL = {
  search_crm: { label: 'Searching CRM', icon: IconSearch },
  get_record_details: { label: 'Reading record', icon: IconDatabase },
  get_sales_snapshot: { label: 'Checking pipeline', icon: IconChartBar },
};

const STORAGE_KEY = 'nexus-copilot-history';

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Minimal, safe markdown: escapes HTML, then renders **bold**, `code`, bullets and line breaks.
function renderMarkdown(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      html += heading ? `<p><strong>${heading[1]}</strong></p>` : line.trim() ? `<p>${line}</p>` : '';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <Group justify={isUser ? 'flex-end' : 'flex-start'} align="flex-start" wrap="nowrap" gap="xs">
      {!isUser && (
        <ThemeIcon size={28} radius="xl" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }} style={{ flexShrink: 0 }}>
          <IconSparkles size={15} />
        </ThemeIcon>
      )}
      <Paper
        p="sm"
        px="md"
        maw="85%"
        radius="lg"
        withBorder={!isUser}
        style={isUser ? { background: 'var(--mantine-color-indigo-filled)', color: 'white' } : undefined}
      >
        {isUser ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
        ) : (
          <>
            {msg.tools?.length > 0 && (
              <Group gap={4} mb={msg.content ? 6 : 0}>
                {msg.tools.map((t, i) => {
                  const meta = TOOL_LABEL[t] || { label: t, icon: IconDatabase };
                  return <Badge key={i} size="xs" variant="light" color="gray" leftSection={<meta.icon size={10} />}>{meta.label}</Badge>;
                })}
              </Group>
            )}
            {msg.content ? (
              <TypographyStylesProvider fz="sm" p={0} style={{ lineHeight: 1.55 }}>
                {/* eslint-disable-next-line react/no-danger */}
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              </TypographyStylesProvider>
            ) : (
              <Loader size="xs" type="dots" />
            )}
            {msg.error && <Text size="xs" c="red" mt={4}>{msg.error}</Text>}
          </>
        )}
      </Paper>
    </Group>
  );
}

export function CopilotDrawer({ opened, onClose }) {
  const { configured, loaded, model } = useAiStatus();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const viewport = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // storage unavailable - history just won't persist
    }
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => m.content && !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '', tools: [] }]);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const patchLast = (fn) => setMessages((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);
    try {
      await aiApi.chat({
        message,
        history,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'text') patchLast((last) => ({ ...last, content: last.content + ev.text }));
          else if (ev.type === 'tool') patchLast((last) => ({ ...last, tools: [...(last.tools || []), ev.name] }));
          else if (ev.type === 'error') patchLast((last) => ({ ...last, error: ev.message }));
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') patchLast((last) => ({ ...last, error: err.message || 'Connection lost' }));
    } finally {
      patchLast((last) => (last.content || last.error ? last : { ...last, content: '_(stopped)_' }));
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={460}
      padding={0}
      withCloseButton
      title={
        <Group gap="xs">
          <ThemeIcon size={30} radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }}><IconSparkles size={17} /></ThemeIcon>
          <div style={{ lineHeight: 1.15 }}>
            <Text fw={800}>Nexus AI Copilot</Text>
            <Text size="xs" c="dimmed">{model ? `Powered by Claude · read-only access` : 'Ask anything about your CRM'}</Text>
          </div>
        </Group>
      }
      styles={{ header: { padding: '12px 16px', borderBottom: '1px solid var(--app-border)' }, body: { height: 'calc(100% - 62px)', display: 'flex', flexDirection: 'column' } }}
    >
      {loaded && !configured ? (
        <Box p="md"><AiNotConfigured /></Box>
      ) : (
        <>
          <ScrollArea style={{ flex: 1 }} viewportRef={viewport} p="md">
            {messages.length === 0 ? (
              <Stack gap="sm" mt="md">
                <Text fw={700} size="lg">Vanakkam {user?.name?.split(' ')[0]} 👋</Text>
                <Text size="sm" c="dimmed">I can look up deals, leads, contacts, tasks and tickets, and tell you what needs attention. Try:</Text>
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="default" justify="flex-start" size="sm" fw={500} onClick={() => send(s)} styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }} h="auto" py={8}>
                    {s}
                  </Button>
                ))}
              </Stack>
            ) : (
              <Stack gap="md">
                {messages.map((m, i) => <Message key={i} msg={m} />)}
              </Stack>
            )}
          </ScrollArea>

          <Box p="sm" style={{ borderTop: '1px solid var(--app-border)' }}>
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <Textarea
                style={{ flex: 1 }}
                autosize
                minRows={1}
                maxRows={5}
                placeholder="Ask about your pipeline, leads, tasks…"
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              {busy ? (
                <Tooltip label="Stop">
                  <ActionIcon size={36} color="red" variant="light" onClick={() => abortRef.current?.abort()}><IconPlayerStop size={18} /></ActionIcon>
                </Tooltip>
              ) : (
                <ActionIcon size={36} variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }} disabled={!input.trim()} onClick={() => send(input)} aria-label="Send">
                  <IconSend size={18} />
                </ActionIcon>
              )}
            </Group>
            <Group justify="space-between" mt={6}>
              <Text size="10px" c="dimmed">Enter to send · Shift+Enter for new line · AI can make mistakes</Text>
              {messages.length > 0 && !busy && (
                <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconTrash size={12} />} onClick={() => setMessages([])}>
                  Clear
                </Button>
              )}
            </Group>
          </Box>
        </>
      )}
    </Drawer>
  );
}
