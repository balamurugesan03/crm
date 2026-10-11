import { Drawer, Text } from '@mantine/core';

export function FormDrawer({ opened, onClose, title, children, size = 420 }) {
  return (
    <Drawer opened={opened} onClose={onClose} position="right" size={size} title={<Text fw={650} size="lg">{title}</Text>}>
      {children}
    </Drawer>
  );
}
