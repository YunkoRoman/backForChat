const mongoose = require('mongoose');
const {Schema} = mongoose;

const MessageSchema = new Schema({
    _id: mongoose.Schema.Types.ObjectId,
    roomId: Number,
    userSenderId: Number,
    userRecipientId: Number,
    date: Date,
    text: String,
});

const MessageModel = mongoose.model('messages', MessageSchema);

module.exports = MessageModel;