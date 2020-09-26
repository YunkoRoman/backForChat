const {usersService} = require('../../services');
const ControllerError = require('../../errors/ControllerError');

module.exports = async (req, res, next) => {
    try {
        console.log(req.body);

       const usersList = await usersService.findUsers();
        console.log(usersList);

        res.json({
            success: true,
            usersList
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/users/users.controller'))
    }
};