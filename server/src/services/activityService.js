import Activity from '../models/Activity.js';
import Deal from '../models/Deal.js';

export async function logActivity({ organization, entityType, entityId, type = 'note', body, createdBy }) {
  const activity = await Activity.create({ organization, entityType, entityId, type, body, createdBy });
  // Any human/automation touch on a deal resets its idle clock for deal-health tracking.
  if (entityType === 'Deal') {
    await Deal.updateOne({ _id: entityId, organization }, { $set: { lastActivityAt: activity.createdAt } });
  }
  return activity;
}
