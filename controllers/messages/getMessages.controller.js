const {messageService} = require('../../services');
const ControllerError = require('../../errors/ControllerError');
const tokenVerif = require("../../helpers/tokenVerifikator");

module.exports = async (req, res, next) => {
    try {
        const token = req.get('Authorization');

        if (token !== undefined || null) {
            const user = tokenVerif.auth(token);
            // console.log(user);
        }

        const {userRecipientId} = req.body;
        // const messages = messageService.getMessages(userRecipientId, userSenderId);

        res.json({
            success: true,
            messages
        });

    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/messages/getMessages.controller'))
    }
};