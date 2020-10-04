const router = require('express').Router();

const {usersController} = require('../controllers/users');


router.get('/lists/:id', usersController);


module.exports = router;