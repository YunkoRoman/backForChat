const mongoose = require('mongoose');
const ControllerError = require('../errors/ControllerError');
const {userModel} = require('../models');

class RegistrationService {

    registerUser(form) {
        try {

            const {name, surname, email, password} = form;


            const newUser = new userModel({
                _id: new mongoose.Types.ObjectId(),
                name,
                surname,
                email,
                password
            });
            userModel.create(newUser);
        } catch (e) {
            throw new ControllerError(e.parent.mongoMsg, 500, 'RegistrationService/registerUser')

        }
    }
}



module.exports = new RegistrationService();