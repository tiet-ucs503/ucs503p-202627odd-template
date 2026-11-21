import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderStatusInput,
} from './orders.schema.js';
import {
  createOrder,
  getOrder,
  listOrders,
  updateOrderLogistics,
  updateOrderStatus,
} from './orders.service.js';

function authenticated(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function orderId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Order id is required');
  }
  return id;
}

export const createOrderController = asyncHandler(async (request, response) => {
  const order = await createOrder(authenticated(request).id, request.body as CreateOrderInput);
  sendSuccess(response, order, 201);
});

export const listOrdersController = asyncHandler(async (request, response) => {
  const result = await listOrders(
    authenticated(request),
    request.query as unknown as ListOrdersQuery,
  );
  sendPaginated(response, result.orders, result.pagination);
});

export const getOrderController = asyncHandler(async (request, response) => {
  const order = await getOrder(authenticated(request), orderId(request));
  sendSuccess(response, order);
});

export const updateOrderStatusController = asyncHandler(async (request, response) => {
  const order = await updateOrderStatus(
    authenticated(request),
    orderId(request),
    request.body as UpdateOrderStatusInput,
  );
  sendSuccess(response, order);
});

export const updateOrderLogisticsController = asyncHandler(async (request, response) => {
  const order = await updateOrderLogistics(
    authenticated(request),
    orderId(request),
    (request.body as { logisticsStatus: 'dispatched' | 'in_transit' | 'delivered' })
      .logisticsStatus,
  );
  sendSuccess(response, order);
});
