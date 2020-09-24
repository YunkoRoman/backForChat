const jwt = require('jsonwebtoken');

let {secret, AuthSecret} = require('../constants/secret');

module.exports = {
    auth: token => {

        if (!token) throw new Error('No token');
        let user = null;

        jwt.verify(token, AuthSecret, (err, decode) => {
            if (err) throw new Error('Not valid token');
            user = decode;
        });

        return user;
    },

    registration: token => {

        if (!token) throw new Error('No token');
        let user = null;

        jwt.verify(token, secret, (err, decode) => {
            if (err) throw new Error('Not valid token');
            user = decode;
        });

        return user;
    }
};