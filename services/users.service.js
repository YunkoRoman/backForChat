const mongoose = require('mongoose');
const ControllerError = require('../errors/ControllerError');
const {userModel} = require('../models');

class UsersService {

    findUsers() {
        try {
            return userModel.find()


        } catch (e) {
            throw new ControllerError(e.message, e.status, 'userService/findUsers')

        }
    }
}


module.exports = new UsersService();