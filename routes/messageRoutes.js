const router = require('express').Router();

const {messageController, getMessages} = require('../controllers/messages');


router.post('/saveMsg', messageController);
router.post('/get', getMessages);


module.exports = router;