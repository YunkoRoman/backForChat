const mongoose = require('mongoose');
const ControllerError = require('../errors/ControllerError');
const {messageModel} = require('../models');

class MessageService {

    saveMessage(form) {
        try {

            const {roomId, userSenderId, userRecipientId, date, text} = form;

            const newMsg = new messageModel({
                _id: new mongoose.Types.ObjectId(),
                roomId,
                userSenderId,
                userRecipientId,
                date,
                text,
            });
            messageModel.create(newMsg);
        } catch (e) {
            throw new ControllerError(e.message, e.status, 'messageService/saveMessage')

        }
    }

    getMessages(userSenderId, userRecipientId) {
        try {


        } catch (e) {
            throw new ControllerError(e.message, e.status, 'messageService/v')

        }
    }
}

module.exports = new MessageService();