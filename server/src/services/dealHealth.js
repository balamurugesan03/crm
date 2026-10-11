const DAY = 864e5;

// Rule-based health for an open deal. Returns { status, daysIdle, daysInStage, reasons[] }.
//   rotting  - no activity for >= rottingDays, or close date missed by > 7 days
//   warning  - idle for half the threshold, close date passed, or stuck in a stage 30+ days
//   healthy  - otherwise
export function computeDealHealth(deal, rottingDays = 7, now = Date.now()) {
  if (deal.status && deal.status !== 'open') return { status: 'closed', daysIdle: 0, daysInStage: 0, reasons: [] };

  const lastTouch = new Date(deal.lastActivityAt || deal.createdAt).getTime();
  const stageSince = new Date(deal.stageChangedAt || deal.createdAt).getTime();
  const daysIdle = Math.max(0, Math.floor((now - lastTouch) / DAY));
  const daysInStage = Math.max(0, Math.floor((now - stageSince) / DAY));
  const closeOverdueDays = deal.expectedCloseDate ? Math.floor((now - new Date(deal.expectedCloseDate).getTime()) / DAY) : null;

  const reasons = [];
  let status = 'healthy';
  const escalate = (level) => {
    if (level === 'rotting' || (level === 'warning' && status === 'healthy')) status = level;
  };

  if (daysIdle >= rottingDays) {
    reasons.push(`No activity for ${daysIdle} days`);
    escalate('rotting');
  } else if (daysIdle >= Math.ceil(rottingDays / 2)) {
    reasons.push(`Quiet for ${daysIdle} days`);
    escalate('warning');
  }
  if (closeOverdueDays !== null && closeOverdueDays > 7) {
    reasons.push(`Close date passed ${closeOverdueDays} days ago`);
    escalate('rotting');
  } else if (closeOverdueDays !== null && closeOverdueDays > 0) {
    reasons.push('Close date has passed');
    escalate('warning');
  }
  if (daysInStage >= 30) {
    reasons.push(`Stuck in stage for ${daysInStage} days`);
    escalate('warning');
  }
  return { status, daysIdle, daysInStage, reasons };
}
