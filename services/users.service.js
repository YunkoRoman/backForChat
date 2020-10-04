const ControllerError = require('../errors/ControllerError');
const {userModel} = require('../models');

class UsersService {

    findUsers(_id) {
        try {
            return userModel.find({
                _id:{
                    $ne:_id
                }
            })


        } catch (e) {
            throw new ControllerError(e.message, e.status, 'userService/findUsers')

        }
    }
}


module.exports = new UsersService();