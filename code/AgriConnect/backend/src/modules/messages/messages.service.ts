import type { Prisma, Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { contactViolationMessage, scanForContactInfo } from '../../common/contact-guard.js';
import { emitOrderMessage } from '../../config/socket.js';
import { getPrismaClient } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { createNotification } from '../../services/notification.service.js';
import type { CreateMessageInput, ListMessagesQuery } from './messages.schema.js';

interface AuthenticatedActor {
  id: string;
  role: Role;
}

const messageInclude = {
  sender: { select: { id: true, name: true } },
} satisfies Prisma.MessageInclude;

function serializeMessage(
  message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
) {
  return {
    id: message.id,
    orderId: message.orderId,
    senderId: message.senderId,
    sender: message.sender,
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
}

async function getParticipantOrder(actor: AuthenticatedActor, orderId: string) {
  const order = await getPrismaClient().order.findFirst({
    where: {
      id: orderId,
      ...(actor.role === 'BUYER'
        ? { buyerId: actor.id }
        : actor.role === 'FARMER'
          ? { farmerId: actor.id }
          : {}),
    },
    select: {
      id: true,
      buyerId: true,
      farmerId: true,
      status: true,
    },
  });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  return order;
}

export async function listMessages(
  actor: AuthenticatedActor,
  orderId: string,
  query: ListMessagesQuery,
) {
  await getParticipantOrder(actor, orderId);

  const skip = (query.page - 1) * query.limit;
  const [messages, total] = await Promise.all([
    getPrismaClient().message.findMany({
      where: { orderId },
      include: messageInclude,
      orderBy: { sentAt: 'asc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().message.count({ where: { orderId } }),
  ]);

  return {
    messages: messages.map(serializeMessage),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function createMessage(
  actor: AuthenticatedActor,
  orderId: string,
  input: CreateMessageInput,
) {
  const order = await getParticipantOrder(actor, orderId);
  if (order.status === 'cancelled') {
    throw new AppError(400, 'INVALID_REQUEST', 'Cannot message on a cancelled order');
  }

  const scan = scanForContactInfo(input.body);
  if (scan.blocked) {
    logger.warn(
      { orderId, senderId: actor.id, violations: scan.violations },
      'Blocked contact-info exchange in order chat',
    );
    throw new AppError(400, 'CONTACT_INFO_BLOCKED', contactViolationMessage(scan.violations));
  }

  const recipientId = actor.id === order.buyerId ? order.farmerId : order.buyerId;

  const preview = input.body.length > 80 ? `${input.body.slice(0, 77)}…` : input.body;

  const message = await getPrismaClient().$transaction(async (transaction) => {
    const created = await transaction.message.create({
      data: {
        orderId,
        senderId: actor.id,
        body: input.body,
      },
      include: messageInclude,
    });

    await createNotification(
      {
        userId: recipientId,
        type: 'MESSAGE_RECEIVED',
        title: 'New message',
        body: preview,
        params: { preview },
        relatedEntityType: 'Order',
        relatedEntityId: orderId,
      },
      transaction,
    );

    return created;
  });

  const serialized = serializeMessage(message);
  emitOrderMessage(orderId, serialized);
  return serialized;
}

export async function markMessagesRead(actor: AuthenticatedActor, orderId: string) {
  const order = await getParticipantOrder(actor, orderId);

  const result = await getPrismaClient().message.updateMany({
    where: {
      orderId,
      senderId: { not: actor.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { orderId: order.id, markedRead: result.count };
}
