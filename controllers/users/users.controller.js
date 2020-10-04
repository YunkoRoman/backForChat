const {usersService} = require('../../services');
const ControllerError = require('../../errors/ControllerError');
const tokenVerif = require("../../helpers/tokenVerifikator");

module.exports = async (req, res, next) => {
    try {


        const {id} = req.params;
        const usersList = await usersService.findUsers(id);

        res.json({
            success: true,
            usersList
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/users/users.controller'))
    }
};