import Deal from '../models/Deal.js';
import Plan, { DEFAULT_PLANS } from '../models/Plan.js';

// Idempotent data backfills run at startup.
export async function runMigrations() {
  const [closed, touched, staged] = await Promise.all([
    Deal.updateMany({ status: { $ne: 'open' }, closedAt: null }, [{ $set: { closedAt: '$updatedAt' } }]),
    Deal.updateMany({ lastActivityAt: null }, [{ $set: { lastActivityAt: '$updatedAt' } }]),
    Deal.updateMany({ stageChangedAt: null }, [{ $set: { stageChangedAt: '$createdAt' } }]),
  ]);
  const n = closed.modifiedCount + touched.modifiedCount + staged.modifiedCount;
  if (n) console.log(`[migrations] backfilled ${n} deal fields`);

  // Seed the plan catalogue once; afterwards super admins manage it in /admin/plans.
  if (!(await Plan.estimatedDocumentCount())) {
    await Plan.insertMany(DEFAULT_PLANS);
    console.log(`[migrations] seeded ${DEFAULT_PLANS.length} default plans`);
  }
}
