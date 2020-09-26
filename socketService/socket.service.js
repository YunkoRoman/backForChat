const ControllerError = require('../errors/ControllerError');

let users = {};

class SocketServise {

    Socket(socket, io) {
        try {

            socket.on('userId', data => {

                socket.userId = data.userId;
                users[socket.userId] = socket;


            });
            socket.on('msg', data => {
                console.log(data);
            })
        } catch (e) {
            throw new ControllerError(e.message, e.status, 'socketService')
        }


    }
}

module.exports = new SocketServise();