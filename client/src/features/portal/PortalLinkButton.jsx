import { Menu, Button } from '@mantine/core';
import { IconWorldShare, IconCopy, IconMail, IconRefresh } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { api } from '../../api/axios.js';
import { confirmDelete } from '../../components/confirmDelete.js';

const createLink = (contactId, opts) => api.post(`/contacts/${contactId}/portal-link`, opts).then((r) => r.data);

export function PortalLinkButton({ contact }) {
  const mutation = useMutation({
    mutationFn: (opts) => createLink(contact._id, opts),
    onSuccess: async (res, opts) => {
      if (res.emailed) {
        notifications.show({ message: `Portal link emailed to ${contact.email}`, color: 'teal' });
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        notifications.show({ title: 'Portal link copied', message: `${opts.revokePrevious ? 'Old links revoked. ' : ''}Valid for 30 days — share it with ${contact.firstName}.`, color: 'teal' });
      } catch {
        window.prompt('Copy this portal link', res.url);
      }
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not create link', color: 'red' }),
  });

  return (
    <Menu position="bottom-end" width={240}>
      <Menu.Target>
        <Button variant="default" leftSection={<IconWorldShare size={14} />} loading={mutation.isPending}>Customer portal</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Secure link · valid 30 days</Menu.Label>
        <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => mutation.mutate({})}>Copy portal link</Menu.Item>
        <Menu.Item leftSection={<IconMail size={14} />} disabled={!contact.email} onClick={() => mutation.mutate({ sendEmail: true })}>Email link to {contact.firstName}</Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconRefresh size={14} />}
          onClick={() =>
            confirmDelete({
              title: 'Revoke existing links?',
              message: 'All portal links previously shared with this contact stop working. A new link is copied.',
              confirmLabel: 'Revoke & copy new',
              onConfirm: () => mutation.mutate({ revokePrevious: true }),
            })
          }
        >
          Revoke old links
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
