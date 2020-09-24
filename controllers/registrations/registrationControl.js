const ControllerError = require('../../errors/ControllerError');
const {registrationService} = require('../../services')

module.exports = async (req, res, next) => {
    try {
        const {form} = req.body;
        console.log(form);

        registrationService.registerUser(form);

        res.json({
            success: true
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'registrationControl'))
    }
};