const ControllerError = require('../errors/ControllerError');
const tokenVerif = require("../helpers/tokenVerifikator");
const mongoose = require("mongoose");
const messageModel = require("../models").messageModel;

let users = {};

class SocketServise {

    Socket(socket, io) {
        try {

            socket.on('userId', data => {
                console.log(data);
                socket.userId = data.userId;
                users[socket.userId] = socket;


            });
            socket.on('msg', async (data, cb) => {
                try {
                    const {token, msg, recipientId, date} = data;
                    // console.log(token);
                    if (token !== undefined || null) {
                        const user = tokenVerif.auth(token);
                        console.log(user);
                        const {_id} = user;

                        //***Create new private msg

                        const newMsg = new messageModel({
                            _id: new mongoose.Types.ObjectId(),
                            userSenderId: _id,
                            userRecipientId:recipientId,
                            date,
                            text: msg,
                        });
                        messageModel.create(newMsg);

                        cb(msg);
                        if (users[recipientId]) {
                            console.log(recipientId);
                            console.log(users[recipientId].id);
                            io.to(users[recipientId].id).emit('privateMsg', msg);
                        }


                    }
                }catch (e) {
                    console.log(e);
                }



            })
        } catch (e) {
            throw new ControllerError(e.message, e.status, 'socketService')
        }


    }
}

module.exports = new SocketServise();