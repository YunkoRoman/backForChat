const mongoose = require('mongoose');
const ControllerError = require('../errors/ControllerError');
const {userModel} = require('../models');
const {messageModel} = require('../models');

class MessageService {

    saveMessage(roomId, userSenderId, userSenderName, userRecipientName, userRecipientId, date, text) {
        try {
            console.log(userSenderId + 'userSenderId');
            console.log(userSenderName + 'userSenderName');
            console.log(userRecipientId + 'userRecipientId');
            console.log(userRecipientName + 'userRecipientName');


            const newMsg = new messageModel({
                _id: new mongoose.Types.ObjectId(),
                roomId,
                userSender: {id: userSenderId, name: userSenderName},
                userRecipient: {id: userRecipientId, name: userRecipientName},
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
            return messageModel.find({
                $or: [
                    {"userSender.id": userSenderId, "userRecipient.id": userRecipientId},
                    {"userSender.id": userRecipientId, "userRecipient.id": userSenderId}
                ]



            })

        } catch (e) {
            throw new ControllerError(e.message, e.status, 'messageService/v')

        }
    }
}

module.exports = new MessageService();