import Stripe from 'stripe';
import { env, isStripeConfigured } from './env.js';

export const stripe = isStripeConfigured ? new Stripe(env.stripeSecretKey) : null;
