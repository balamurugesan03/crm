import { api } from './axios.js';

export const attachmentsApi = {
  list: (entityType, entityId) => api.get('/attachments', { params: { entityType, entityId } }).then((r) => r.data),
  upload: (entityType, entityId, files, onUploadProgress) => {
    const form = new FormData();
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    files.forEach((f) => form.append('files', f));
    return api.post('/attachments', form, { onUploadProgress }).then((r) => r.data);
  },
  // Fetch through axios so the auth header is sent, then hand the browser a blob URL.
  download: async (attachment, { inline = false } = {}) => {
    const res = await api.get(`/attachments/${attachment._id}/download`, { params: { inline }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (inline) {
      window.open(url, '_blank', 'noopener');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.originalName;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  remove: (id) => api.delete(`/attachments/${id}`).then((r) => r.data),
};
