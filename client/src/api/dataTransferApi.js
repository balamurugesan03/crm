import { api } from './axios.js';

async function saveBlob(path, fallbackName) {
  const res = await api.get(path, { responseType: 'blob' });
  const match = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] || '');
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] || fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const dataTransferApi = {
  exportCsv: (entity) => saveBlob(`/data/${entity}/export`, `${entity}.csv`),
  downloadTemplate: (entity) => saveBlob(`/data/${entity}/template`, `${entity}-template.csv`),
  importCsv: (entity, csv) => api.post(`/data/${entity}/import`, { csv }).then((r) => r.data),
};
