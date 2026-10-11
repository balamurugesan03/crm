import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { paginationParams, buildSearchFilter } from '../utils/queryHelpers.js';

export const listProducts = catchAsync(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { organization: req.tenantId, ...buildSearchFilter(req.query.search, ['name', 'sku']) };
  if (req.query.activeOnly === 'true') filter.isActive = true;

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const createProduct = catchAsync(async (req, res) => {
  const product = await Product.create({ ...req.body, organization: req.tenantId });
  res.status(201).json(product);
});

export const updateProduct = catchAsync(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, organization: req.tenantId },
    req.body,
    { new: true, runValidators: true },
  );
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

export const deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!product) throw new AppError('Product not found', 404);
  res.status(204).send();
});
