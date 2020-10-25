const {messageService} = require('../../services');
const ControllerError = require('../../errors/ControllerError');
const tokenVerif = require("../../helpers/tokenVerifikator");

module.exports = async (req, res, next) => {
    try {

        const token = req.get('Authorization');
        const user = tokenVerif.auth(token);
        if (user !== undefined || null) {

            const {_id: userSenderId} = user;
            const {id:userRecipientId} = req.params;

            const messages = await messageService.getMessages(userSenderId, userRecipientId);

            res.json({
                success: true,
                messages
            });
        } else {
            res.json({
                success: false
            });
        }




    } catch (e) {
        next(new ControllerError(e.message, e.status, 'controllers/messages/getMessages.controller'))
    }
};