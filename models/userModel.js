const mongoose = require('mongoose');
const {Schema} = mongoose;

const RegistrationSchema = new Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    surname: String,
    email: String,
    password: String
});

const RegistrationModel = mongoose.model('users', RegistrationSchema);

module.exports = RegistrationModel;