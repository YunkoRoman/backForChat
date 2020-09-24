const router = require('express').Router();

const {registrationController} = require('../controllers/registrations');


router.post('/', registrationController);


module.exports = router;