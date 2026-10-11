import { useEffect, useState } from 'react';
import { Paper, Stack, Group, TextInput, NumberInput, Button, ActionIcon, Badge, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash, IconArrowUp, IconArrowDown, IconDeviceFloppy } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { pipelineStagesApi } from '../../api/pipelineStagesApi.js';
import { confirmDelete } from '../../components/confirmDelete.js';

// Inline editor for the deal pipeline: rename, reorder, and set win probability per stage.
export function PipelineTab() {
  const queryClient = useQueryClient();
  const { data: stages = [] } = useQuery({ queryKey: ['pipeline-stages'], queryFn: pipelineStagesApi.list });
  const [draft, setDraft] = useState([]);

  useEffect(() => setDraft(stages.map((s) => ({ ...s }))), [stages]);

  const dirty = JSON.stringify(draft.map(({ _id, name, order, probability }) => ({ _id, name, order, probability })))
    !== JSON.stringify(stages.map(({ _id, name, order, probability }) => ({ _id, name, order, probability })));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      const changed = draft.filter((d) => {
        const orig = stages.find((s) => s._id === d._id);
        return orig && (orig.name !== d.name || orig.order !== d.order || orig.probability !== d.probability);
      });
      await Promise.all(changed.map((d) => pipelineStagesApi.update(d._id, { name: d.name, order: d.order, probability: d.probability })));
    },
    onSuccess: () => {
      invalidate();
      notifications.show({ message: 'Pipeline saved', color: 'teal' });
    },
  });

  const addStage = useMutation({
    mutationFn: () => {
      const openStages = draft.filter((s) => !s.isWon && !s.isLost);
      const order = (openStages[openStages.length - 1]?.order || 0) + 0.5;
      return pipelineStagesApi.create({ name: 'New stage', order, probability: 50 });
    },
    onSuccess: invalidate,
  });

  const removeStage = useMutation({
    mutationFn: pipelineStagesApi.remove,
    onSuccess: invalidate,
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not delete stage', color: 'red' }),
  });

  function move(index, dir) {
    const next = [...draft];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next.map((s, i) => ({ ...s, order: i + 1 })));
  }

  function update(index, patch) {
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <Paper p="lg" maw={760}>
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={700}>Deal pipeline</Text>
          <Text size="sm" c="dimmed">Stage probability drives the weighted forecast on the dashboard.</Text>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => addStage.mutate()} loading={addStage.isPending}>Add stage</Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} disabled={!dirty} loading={saveAll.isPending} onClick={() => saveAll.mutate()}>Save</Button>
        </Group>
      </Group>

      <Stack gap="xs">
        {draft.map((stage, i) => (
          <Group key={stage._id} gap="sm" wrap="nowrap" p="xs" style={{ borderRadius: 8, background: 'var(--app-subtle)' }}>
            <Stack gap={0}>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp size={12} /></ActionIcon>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => move(i, 1)} disabled={i === draft.length - 1}><IconArrowDown size={12} /></ActionIcon>
            </Stack>
            <TextInput value={stage.name} onChange={(e) => update(i, { name: e.currentTarget.value })} style={{ flex: 1 }} />
            <NumberInput value={stage.probability} onChange={(v) => update(i, { probability: Number(v) || 0 })} min={0} max={100} suffix="%" w={100} />
            {stage.isWon && <Badge color="teal" variant="light">Won</Badge>}
            {stage.isLost && <Badge color="red" variant="light">Lost</Badge>}
            <Tooltip label={stage.isWon || stage.isLost ? 'Won/Lost stages are required' : 'Delete stage'}>
              <ActionIcon
                variant="subtle"
                color="red"
                disabled={stage.isWon || stage.isLost}
                onClick={() =>
                  confirmDelete({
                    message: `Delete stage "${stage.name}"? Move its deals to another stage first.`,
                    onConfirm: () => removeStage.mutate(stage._id),
                  })
                }
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
