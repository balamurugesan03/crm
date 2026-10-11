import {
  IconLayoutDashboard,
  IconUsers,
  IconBuilding,
  IconTargetArrow,
  IconStack2,
  IconChecklist,
  IconSettings,
  IconBox,
  IconFileText,
  IconReceipt,
  IconChartBar,
  IconHeadset,
  IconSpeakerphone,
  IconCalendarEvent,
  IconBolt,
  IconTarget,
  IconForms,
  IconCash,
  IconReceiptTax,
} from '@tabler/icons-react';

export const navSections = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', to: '/', icon: IconLayoutDashboard },
      { label: 'Calendar', to: '/calendar', icon: IconCalendarEvent },
      { label: 'Tasks', to: '/tasks', icon: IconChecklist },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Leads', to: '/leads', icon: IconTargetArrow },
      { label: 'Deals', to: '/deals', icon: IconStack2 },
      { label: 'Contacts', to: '/contacts', icon: IconUsers },
      { label: 'Companies', to: '/companies', icon: IconBuilding },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Products', to: '/products', icon: IconBox },
      { label: 'Quotes', to: '/quotes', icon: IconFileText },
      { label: 'Targets', to: '/targets', icon: IconTarget },
      { label: 'Reports', to: '/reports', icon: IconChartBar },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', to: '/invoices', icon: IconReceipt },
      { label: 'Receivables', to: '/receivables', icon: IconCash },
      { label: 'GST returns', to: '/gst-returns', icon: IconReceiptTax },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'Tickets', to: '/tickets', icon: IconHeadset },
      { label: 'Campaigns', to: '/campaigns', icon: IconSpeakerphone },
      { label: 'Web forms', to: '/web-forms', icon: IconForms },
      { label: 'Automations', to: '/automations', icon: IconBolt },
    ],
  },
];

export const bottomNavItems = [{ label: 'Settings', to: '/settings', icon: IconSettings }];
