const mongoose = require('mongoose');
const {userModel} = require('../models');


const ControllerError = require('../errors/ControllerError');

class authService {

    authUser(email, password) {


        try {
            if (!email && !password) throw new Error('Some field is empty');
            return userModel.findOne({
                email,
                password
            })

        } catch (e) {
            throw new ControllerError(e.message, e.status, 'userService/authUser')
        }
    }


}


module.exports = new authService();