export const TRIGGERS = [
  { value: 'lead.created', label: 'Lead is created', group: 'Leads' },
  { value: 'lead.status_changed', label: 'Lead status changes', group: 'Leads' },
  { value: 'deal.created', label: 'Deal is created', group: 'Deals' },
  { value: 'deal.stage_changed', label: 'Deal moves stage', group: 'Deals' },
  { value: 'deal.won', label: 'Deal is won', group: 'Deals' },
  { value: 'deal.lost', label: 'Deal is lost', group: 'Deals' },
  { value: 'ticket.created', label: 'Ticket is created', group: 'Support' },
  { value: 'ticket.status_changed', label: 'Ticket status changes', group: 'Support' },
  { value: 'contact.created', label: 'Contact is created', group: 'Contacts' },
];

export const TRIGGER_LABEL = Object.fromEntries(TRIGGERS.map((t) => [t.value, t.label]));

// Fields a condition / update can reference, per record type.
export const FIELDS_BY_ENTITY = {
  lead: [
    { value: 'status', label: 'Status', options: ['new', 'contacted', 'qualified', 'unqualified', 'converted'] },
    { value: 'source', label: 'Source', options: ['website', 'referral', 'social', 'event', 'cold_call', 'advertisement', 'other'] },
    { value: 'estimatedValue', label: 'Estimated value', numeric: true },
    { value: 'score', label: 'Lead score', numeric: true },
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
  ],
  deal: [
    { value: 'amount', label: 'Amount', numeric: true },
    { value: 'stageName', label: 'Stage name' },
    { value: 'status', label: 'Status', options: ['open', 'won', 'lost'] },
    { value: 'title', label: 'Title' },
  ],
  ticket: [
    { value: 'priority', label: 'Priority', options: ['low', 'medium', 'high', 'urgent'] },
    { value: 'status', label: 'Status', options: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
    { value: 'subject', label: 'Subject' },
  ],
  contact: [
    { value: 'jobTitle', label: 'Job title' },
    { value: 'email', label: 'Email' },
  ],
};

export const OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
];

export const ACTIONS = [
  { value: 'create_task', label: 'Create a task' },
  { value: 'notify_user', label: 'Send in-app notification' },
  { value: 'update_field', label: 'Update a field' },
  { value: 'add_note', label: 'Add a timeline note' },
];

export const ACTION_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]));

export function entityOf(trigger) {
  return (trigger || 'lead.created').split('.')[0];
}
