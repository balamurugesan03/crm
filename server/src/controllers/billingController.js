import { stripe } from '../config/stripe.js';
import { env, isStripeConfigured } from '../config/env.js';
import Organization from '../models/Organization.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const PLAN_CATALOG = [
  { plan: 'starter', name: 'Starter', priceLabel: '₹1,999/mo', features: ['Up to 5 team members', 'Core CRM + Sales tools'] },
  { plan: 'pro', name: 'Pro', priceLabel: '₹4,999/mo', features: ['Up to 20 team members', 'Everything in Starter', 'Reports & Support desk'] },
  { plan: 'enterprise', name: 'Enterprise', priceLabel: 'Contact us', features: ['Unlimited team members', 'Everything in Pro', 'Priority support'] },
];

function priceIdToPlan(priceId) {
  return Object.entries(env.stripePrices).find(([, id]) => id === priceId)?.[0];
}

export const getPlans = catchAsync(async (req, res) => {
  res.json({ configured: isStripeConfigured, plans: PLAN_CATALOG });
});

export const createCheckoutSession = catchAsync(async (req, res) => {
  if (!isStripeConfigured) {
    throw new AppError('Billing is not configured yet. Add Stripe API keys to enable upgrades.', 501);
  }

  const { plan } = req.body;
  const priceId = env.stripePrices[plan];
  if (!priceId) throw new AppError('Unknown plan selected', 400);

  const organization = await Organization.findById(req.tenantId);
  if (!organization) throw new AppError('Organization not found', 404);

  let customerId = organization.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: organization.name,
      email: req.user.email,
      metadata: { organizationId: organization._id.toString() },
    });
    customerId = customer.id;
    organization.stripeCustomerId = customerId;
    await organization.save();
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.clientUrl}/settings?billing=success`,
    cancel_url: `${env.clientUrl}/settings?billing=cancelled`,
    client_reference_id: organization._id.toString(),
    metadata: { organizationId: organization._id.toString() },
  });

  res.json({ url: session.url });
});

export const createPortalSession = catchAsync(async (req, res) => {
  if (!isStripeConfigured) {
    throw new AppError('Billing is not configured yet. Add Stripe API keys to enable this.', 501);
  }

  const organization = await Organization.findById(req.tenantId);
  if (!organization?.stripeCustomerId) {
    throw new AppError('No billing account found for this organization yet', 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: `${env.clientUrl}/settings`,
  });

  res.json({ url: session.url });
});

export const handleWebhook = catchAsync(async (req, res) => {
  if (!isStripeConfigured) {
    return res.status(501).json({ message: 'Billing is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const organizationId = session.metadata?.organizationId || session.client_reference_id;
      if (organizationId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceIdToPlan(priceId) || 'starter';
        await Organization.findByIdAndUpdate(organizationId, {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          plan,
          subscriptionStatus: 'active',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = priceIdToPlan(priceId);
      const statusMap = { active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled', unpaid: 'past_due' };
      await Organization.findOneAndUpdate(
        { stripeCustomerId: subscription.customer },
        {
          ...(plan ? { plan } : {}),
          subscriptionStatus: statusMap[subscription.status] || 'active',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await Organization.findOneAndUpdate(
        { stripeCustomerId: subscription.customer },
        { subscriptionStatus: 'canceled' },
      );
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});
