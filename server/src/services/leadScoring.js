// Rule-based lead score (0-100). Transparent weights so reps can see why a lead ranks where it does.
const SOURCE_WEIGHTS = {
  referral: 25,
  event: 18,
  website: 15,
  social: 10,
  advertisement: 8,
  cold_call: 5,
  other: 3,
};

const STATUS_WEIGHTS = {
  new: 0,
  contacted: 8,
  qualified: 20,
  unqualified: -40,
  converted: 25,
};

function valuePoints(value) {
  if (value >= 1000000) return 25;
  if (value >= 500000) return 20;
  if (value >= 100000) return 14;
  if (value >= 25000) return 8;
  if (value > 0) return 4;
  return 0;
}

export function computeLeadScore(lead) {
  let score = 0;
  if (lead.email) score += 12;
  if (lead.phone) score += 8;
  if (lead.company) score += 10;
  score += SOURCE_WEIGHTS[lead.source] ?? 0;
  score += STATUS_WEIGHTS[lead.status] ?? 0;
  score += valuePoints(Number(lead.estimatedValue) || 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}
