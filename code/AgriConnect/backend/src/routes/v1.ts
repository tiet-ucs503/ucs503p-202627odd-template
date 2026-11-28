import { Router } from 'express';
import { sendSuccess } from '../common/response.js';
import { alertsRouter } from '../modules/alerts/alerts.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';
import { agronomistRouter } from '../modules/agronomist/agronomist.routes.js';
import { marketRouter } from '../modules/market/market.routes.js';
import { assistantRouter } from '../modules/assistant/assistant.routes.js';
import { weatherRouter } from '../modules/weather/weather.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { bidsRouter } from '../modules/bids/bids.routes.js';
import { listingsRouter } from '../modules/listings/listings.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { ordersRouter } from '../modules/orders/orders.routes.js';
import { paymentsRouter } from '../modules/payments/payments.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { reviewsRouter } from '../modules/reviews/reviews.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';

export const apiV1Router = Router();

apiV1Router.get('/', (_request, response) => {
  sendSuccess(response, {
    name: 'AgriConnect API',
    version: 'v1',
  });
});

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
apiV1Router.use('/listings', listingsRouter);
apiV1Router.use('/orders', ordersRouter);
apiV1Router.use('/bids', bidsRouter);
apiV1Router.use('/payments', paymentsRouter);
apiV1Router.use('/notifications', notificationsRouter);
apiV1Router.use('/reports', reportsRouter);
apiV1Router.use('/', reviewsRouter);
apiV1Router.use('/market', marketRouter);
apiV1Router.use('/alerts', alertsRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/agronomist', agronomistRouter);
apiV1Router.use('/assistant', assistantRouter);
apiV1Router.use('/weather', weatherRouter);
