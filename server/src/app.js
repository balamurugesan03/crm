import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import pipelineStageRoutes from './routes/pipelineStageRoutes.js';
import dealRoutes from './routes/dealRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import productRoutes from './routes/productRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import automationRoutes from './routes/automationRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import dataTransferRoutes from './routes/dataTransferRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import targetRoutes from './routes/targetRoutes.js';
import webFormRoutes from './routes/webFormRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import customFieldRoutes from './routes/customFieldRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import { handleWebhook } from './controllers/billingController.js';
import { auditLog } from './middleware/auditLog.js';

const app = express();

if (env.trustProxy) app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));

// Stripe webhook needs the raw request body for signature verification,
// so it must be registered before the global express.json() parser.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
// Skip SSE responses: compression buffers them and breaks token streaming.
app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/ai/chat') && compression.filter(req, res) }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many login attempts, please try again later' } }));
app.use('/api', auditLog);

app.get('/api/health', (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
  res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) });
});

app.use('/api/auth', authRoutes);
app.use('/api/companies', requireAuth, companyRoutes);
app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/pipeline-stages', requireAuth, pipelineStageRoutes);
app.use('/api/deals', requireAuth, dealRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/organization', requireAuth, organizationRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/quotes', requireAuth, quoteRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/tickets', requireAuth, ticketRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/billing', requireAuth, billingRoutes);
app.use('/api/search', requireAuth, searchRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/attachments', requireAuth, attachmentRoutes);
app.use('/api/automations', requireAuth, automationRoutes);
app.use('/api/audit-logs', requireAuth, auditLogRoutes);
app.use('/api/data', requireAuth, dataTransferRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/targets', requireAuth, targetRoutes);
app.use('/api/web-forms', requireAuth, webFormRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/custom-fields', requireAuth, customFieldRoutes);
app.use('/api/messages', requireAuth, messageRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/finance', requireAuth, financeRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
