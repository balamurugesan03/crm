export async function nextNumber(Model, organization, prefix) {
  const count = await Model.countDocuments({ organization });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}
