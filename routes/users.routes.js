const router = require('express').Router();

const {usersController} = require('../controllers/users');


router.post('/lists', usersController);


module.exports = router;