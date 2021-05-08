const ControllerError = require('../errors/ControllerError');
const tokenVerif = require("../helpers/tokenVerifikator");
const mongoose = require("mongoose");
const messageModel = require("../models").messageModel;
const {usersService} = require('../services');

let users = {};

class SocketServise {

    Socket(socket, io) {
        try {

            socket.on('userId', data => {

                socket.userId = data.userId;
                users[socket.userId] = socket;



            });
            socket.on('msg', async (data, cb) => {
                try {
                    const {userRecipientId, userRecipientName, msg, senderId, senderName, date} = data;

                    //***Create new private msg

                    const newMsg = new messageModel({
                        _id: new mongoose.Types.ObjectId(),
                        userSender: {id: senderId, name: senderName},
                        userRecipient: {id: userRecipientId, name: userRecipientName},
                        date,
                        text: msg,
                    });
                    messageModel.create(newMsg);

                    cb(userRecipientId, userRecipientName, msg, senderId, senderName, date);
                    if (users[userRecipientId]) {

                        io.to(users[userRecipientId].id).emit('privateMsg', msg);
                    }


                } catch (e) {
                    console.log(e);
                }


            })
        } catch (e) {
            throw new ControllerError(e.message, e.status, 'socketService')
        }

        socket.on('disconnect', () => {

            users[socket.userId] = null;

        });
    }
}

module.exports = new SocketServise();