const {tokinayzer} = require('../../helpers');
const ControllerError = require('../../errors/ControllerError');
const {authUserService} = require('../../services');

//Authorisation user


module.exports = async (req, res, next) => {
    try {
        const {email, password} = req.body;

        if (!email && !password) throw new Error('Some field is empty');

        const UserIsRegistr = await authUserService.authUser(email, password);

        if ( UserIsRegistr === null) throw new Error('You are not register');

        const {_id, name} = await UserIsRegistr;

        const token = tokinayzer.auth({_id, name});
        res.json({
            success: true,
            msg: token
        })


    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/auth/authUser'))
    }

};
