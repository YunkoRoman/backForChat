const {messageService} = require('../../services')
const ControllerError = require('../../errors/ControllerError');

module.exports = async (req, res, next) => {
    try {
        const token = req.get('Authorization');

        const user = tokenVerif.auth(token);
        console.log(user);
        const {_id: userSenderId} = user;
        // messageService.saveMessage();

        res.json({
            success: true,
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/messages/messageController'))
    }
};