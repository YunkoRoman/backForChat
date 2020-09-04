const router = require('express').Router();

const {messageController} = require('../controllers/messages');


router.post('/saveMsg', messageController);


module.exports = router;