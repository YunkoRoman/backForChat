const router = require('express').Router();


const {authUser} = require('../controllers/auth');



router.post('/', authUser);




module.exports = router;