const router = require('express').Router();

const {usersController} = require('../controllers/users');


router.get('/lists', usersController);


module.exports = router;