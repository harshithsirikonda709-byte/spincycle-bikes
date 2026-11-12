const express = require('express');

function createRentalRoutes(rentalController) {
  const router = express.Router();

  router.get('/', rentalController.getAllRentals);
  router.get('/details', rentalController.getRentalDetails);
  router.post('/', rentalController.createRental);
  router.patch('/:id/return', rentalController.returnRental);

  return router;
}

module.exports = {
  createRentalRoutes,
};

