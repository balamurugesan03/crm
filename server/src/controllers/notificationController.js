import Notification from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const listNotifications = catchAsync(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ organization: req.tenantId, user: req.user._id }).sort({ createdAt: -1 }).limit(20),
    Notification.countDocuments({ organization: req.tenantId, user: req.user._id, isRead: false }),
  ]);
  res.json({ items, unreadCount });
});

export const markRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId, user: req.user._id },
    { isRead: true },
    { new: true },
  );
  if (!notification) throw new AppError('Notification not found', 404);
  res.json(notification);
});

export const markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { organization: req.tenantId, user: req.user._id, isRead: false },
    { isRead: true },
  );
  res.status(204).send();
});
