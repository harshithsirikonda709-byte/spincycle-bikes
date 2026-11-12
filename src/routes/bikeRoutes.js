const express = require('express');

function createBikeRoutes(bikeController) {
  const router = express.Router();

  router.get('/', bikeController.getAllBikes);
  router.get('/:id', bikeController.getBikeById);
  router.post('/', bikeController.createBike);
  router.put('/:id', bikeController.updateBike);
  router.delete('/:id', bikeController.deleteBike);

  return router;
}

module.exports = {
  createBikeRoutes,
};

