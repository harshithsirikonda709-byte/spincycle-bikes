const express = require('express');
const { createRiderModel } = require('./db/riderModel');
const { createBikeModel } = require('./db/bikeModel');
const { createRentalModel } = require('./db/rentalModel');
const { createRiderController } = require('./controllers/riderController');
const { createBikeController } = require('./controllers/bikeController');
const { createRentalController } = require('./controllers/rentalController');
const { createRiderRoutes } = require('./routes/riderRoutes');
const { createBikeRoutes } = require('./routes/bikeRoutes');
const { createRentalRoutes } = require('./routes/rentalRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Builds and configures the Express application with the provided database instance.
 */
function createApp(db) {
  const app = express();

  app.use(express.json());

  const riderModel = createRiderModel(db);
  const bikeModel = createBikeModel(db);
  const rentalModel = createRentalModel(db);

  const riderController = createRiderController(riderModel);
  const bikeController = createBikeController(bikeModel);
  const rentalController = createRentalController(rentalModel);

  app.get('/', (req, res) => {
    res.status(200).json({
      service: 'SpinCycle Bikes – Campus Bike Share Management System',
      status: 'running',
      endpoints: {
        riders: ['/riders'],
        bikes: ['/bikes', '/bikes/:id', '/bikes?type=Mountain'],
        rentals: ['/rentals', '/rentals/details', '/rentals/:id/return'],
      },
    });
  });

  app.use('/riders', createRiderRoutes(riderController));
  app.use('/bikes', createBikeRoutes(bikeController));
  app.use('/rentals', createRentalRoutes(rentalController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};

