const tokenVerif = require('../../helpers/tokenVerifikator');
const ControllerError = require('../../errors/ControllerError');


module.exports = async (req, res, next) => {
    try {
        // The user is verify for valid token

        const token = req.get('Authorization');
        console.log(token);
        if (!token) throw new Error('No token');

        const user = tokenVerif.auth(token);
        console.log(user);
        user ?
            res.json(
                true
            )
            :
            res.json(
                false
            )


    } catch (e) {
        next(new ControllerError(e.message, e.status, 'authUser'))
    }
}