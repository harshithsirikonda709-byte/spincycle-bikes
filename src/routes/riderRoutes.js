const express = require('express');

function createRiderRoutes(riderController) {
  const router = express.Router();

  router.get('/', riderController.getAllRiders);
  router.post('/', riderController.createRider);

  return router;
}

module.exports = {
  createRiderRoutes,
};

