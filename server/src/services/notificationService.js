import Notification from '../models/Notification.js';
import { emitToUser } from '../realtime/socket.js';

export async function notifyUser({ organization, user, type, title, body, link }) {
  const notification = await Notification.create({ organization, user, type, title, body, link });
  emitToUser(String(user), 'notification:new', notification);
  return notification;
}
