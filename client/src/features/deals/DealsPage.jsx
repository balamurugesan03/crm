import { useState } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Button, Group, Paper, Stack, Text, Badge, ScrollArea, Box, Center, Loader, SegmentedControl } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { pipelineStagesApi } from '../../api/pipelineStagesApi.js';
import { dealsApi } from '../../api/dealsApi.js';
import { DealCard } from './DealCard.jsx';
import { DealFormDrawer } from './DealFormDrawer.jsx';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

export function DealsPage() {
  const queryClient = useQueryClient();
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultStageId, setDefaultStageId] = useState(null);
  const [params, setParams] = useSearchParams();
  const healthFilter = params.get('health') || 'all';
  useOpenOnNewParam(() => { setEditing(null); setDefaultStageId(null); setDrawerOpened(true); });

  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: pipelineStagesApi.list,
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: dealsApi.list,
  });

  const updateStage = useMutation({
    mutationFn: ({ id, stage }) => dealsApi.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const previous = queryClient.getQueryData(['deals']);
      queryClient.setQueryData(['deals'], (old) =>
        (old || []).map((d) => (d._id === id ? { ...d, stage: stages.find((s) => s._id === stage) } : d)),
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['deals'], context.previous);
      notifications.show({ message: 'Could not move deal', color: 'red' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });

  function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    updateStage.mutate({ id: draggableId, stage: destination.droppableId });
  }

  function openCreate(stageId) {
    setEditing(null);
    setDefaultStageId(stageId);
    setDrawerOpened(true);
  }

  if (stagesLoading || dealsLoading) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    );
  }

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle="Drag deals across stages as they progress"
        action={
          <>
            <SegmentedControl
              value={healthFilter}
              onChange={(v) => setParams(v === 'all' ? {} : { health: v }, { replace: true })}
              data={[
                { value: 'all', label: `All (${deals.length})` },
                { value: 'at_risk', label: `At risk (${deals.filter((d) => d.health && d.health.status !== 'healthy').length})` },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={() => openCreate(null)}>New deal</Button>
          </>
        }
      />

      <ScrollArea offsetScrollbars type="auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Group align="flex-start" wrap="nowrap" gap="md">
            {stages.map((stage) => {
              const stageDeals = deals.filter(
                (d) => (d.stage?._id || d.stage) === stage._id && (healthFilter === 'all' || (d.health && d.health.status !== 'healthy')),
              );
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
              return (
                <Box key={stage._id} w={280} miw={280}>
                  <Paper p="sm" mb="xs" bg="var(--app-surface)" shadow="xs">
                    <Group justify="space-between">
                      <Text fw={600} size="sm">{stage.name}</Text>
                      <Badge variant="light" color="gray" size="sm">{stageDeals.length}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{formatCurrency(stageValue)}</Text>
                  </Paper>

                  <Droppable droppableId={stage._id}>
                    {(provided, snapshot) => (
                      <Stack
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        mih={200}
                        p={6}
                        gap={0}
                        style={{
                          background: snapshot.isDraggingOver ? 'var(--app-highlight)' : 'transparent',
                          borderRadius: 8,
                          transition: 'background 120ms ease',
                        }}
                      >
                        {stageDeals.map((deal, index) => (
                          <DealCard
                            key={deal._id}
                            deal={deal}
                            index={index}
                            onClick={(d) => { setEditing(d); setDefaultStageId(null); setDrawerOpened(true); }}
                          />
                        ))}
                        {provided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </Box>
              );
            })}
          </Group>
        </DragDropContext>
      </ScrollArea>

      <DealFormDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        deal={editing}
        stages={stages}
        defaultStageId={defaultStageId}
      />
    </>
  );
}
