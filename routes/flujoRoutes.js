const express = require('express');
const flujoController = require('../controllers/flujoController');
const router = express.Router();

router.get('/flujo/data', flujoController.getFlujo);
router.post('/flujo/save', flujoController.postFlujo);

module.exports = router;