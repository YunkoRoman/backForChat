const tokenVerif = require('../../helpers/tokenVerifikator');
const ControllerError = require('../../errors/ControllerError');


module.exports = async (req, res, next) => {
    try {

        const token = req.get('Authorization');

        if (token !==undefined || null) {
            const user = tokenVerif.auth(token);

            res.json({
                    success: true
                }
            )
        }else res.json(
            {
                success: false
            })


    } catch (e) {
        next(new ControllerError(e.message, e.status, 'checkUser'))
    }
};