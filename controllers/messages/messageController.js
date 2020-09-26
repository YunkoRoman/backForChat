const {messageService} = require('../../services')
const ControllerError = require('../../errors/ControllerError');

module.exports = async (req, res, next) => {
    try {
        console.log(req.body);

        messageService.saveMessage(req.body);

        res.json({
            success: true,
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/messages/messageController'))
    }
};