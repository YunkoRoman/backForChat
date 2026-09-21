const {usersService} = require('../../services');
const ControllerError = require('../../errors/ControllerError');
const tokenVerif = require("../../helpers/tokenVerifikator");

module.exports = async (req, res, next) => {
    try {


        const {id, token} = req.body;

        const user = tokenVerif.auth(token);
        if (user !== undefined || null) {
            const usersList = await usersService.findUsers(id);

            res.json({
                success: true,
                usersList
            })
        }


    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/users/users.controller'))
    }
};