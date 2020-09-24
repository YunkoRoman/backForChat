const router = require('express').Router();


const {authUser, checkUser} = require('../controllers/auth');



router.post('/', authUser);
router.get('/check', checkUser);



module.exports = router;