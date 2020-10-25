const router = require('express').Router();

const {messageController, getMessages} = require('../controllers/messages');


router.post('/saveMsg', messageController);
router.get('/get/:id', getMessages);


module.exports = router;