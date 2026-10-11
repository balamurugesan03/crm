import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import mongoose from 'mongoose';
import Attachment, { ATTACHMENT_ENTITY_TYPES } from '../models/Attachment.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { logActivity } from '../services/activityService.js';

export const UPLOAD_DIR = env.uploadDir;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr', '.js', '.html', '.htm', '.svg']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, String(req.tenantId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter: (req, file, cb) => {
    if (BLOCKED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      return cb(new AppError('This file type is not allowed', 400));
    }
    return cb(null, true);
  },
}).array('files', 5);

function assertEntity(entityType, entityId) {
  if (!ATTACHMENT_ENTITY_TYPES.includes(entityType)) throw new AppError('Invalid entity type', 400);
  if (!mongoose.isValidObjectId(entityId)) throw new AppError('Invalid entity id', 400);
}

export const listAttachments = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.query;
  assertEntity(entityType, entityId);
  const items = await Attachment.find({ organization: req.tenantId, entityType, entityId })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name avatarColor');
  res.json(items);
});

export const uploadAttachments = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.body;
  assertEntity(entityType, entityId);
  const Model = mongoose.model(entityType);
  const exists = await Model.exists({ _id: entityId, organization: req.tenantId });
  if (!exists) throw new AppError(`${entityType} not found`, 404);
  if (!req.files?.length) throw new AppError('No files uploaded', 400);

  const docs = await Attachment.insertMany(
    req.files.map((f) => ({
      organization: req.tenantId,
      entityType,
      entityId,
      originalName: f.originalname,
      storedName: f.filename,
      mimeType: f.mimetype,
      size: f.size,
      uploadedBy: req.user._id,
    })),
  );

  if (entityType !== 'Lead') {
    await logActivity({
      organization: req.tenantId,
      entityType,
      entityId,
      type: 'attachment',
      body: `${req.user.name} attached ${docs.map((d) => d.originalName).join(', ')}`,
      createdBy: req.user._id,
    });
  }

  res.status(201).json(docs);
});

export const downloadAttachment = catchAsync(async (req, res) => {
  const attachment = await Attachment.findOne({ _id: req.params.id, organization: req.tenantId });
  if (!attachment) throw new AppError('Attachment not found', 404);
  const filePath = path.join(UPLOAD_DIR, String(req.tenantId), attachment.storedName);
  if (!fs.existsSync(filePath)) throw new AppError('File is missing from storage', 404);
  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(res);
});

export const deleteAttachment = catchAsync(async (req, res) => {
  const attachment = await Attachment.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!attachment) throw new AppError('Attachment not found', 404);
  fs.promises.unlink(path.join(UPLOAD_DIR, String(req.tenantId), attachment.storedName)).catch(() => {});
  res.status(204).send();
});
