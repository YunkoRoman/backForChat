const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const {
    StatusCodes,
    getReasonPhrase,
} = require('http-status-codes');
const {messageRoutes, rigistrationRoutes, authRoutes, usersRoutes} = require('./routes');
const {socketService} = require('./socketService');

dotenv.config();
const MONGO_PATH = process.env.DB_MONGO_PATH;
mongoose.connect(MONGO_PATH, { useNewUrlParser: true, useUnifiedTopology:true});

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);


io.on('connection', async socket => {

    await socketService.Socket(socket, io);
});
const PORT = process.env.PORT;

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:4200");
    res.header("Access-Control-Allow-Credentials", true);
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

app.use(cors());
app.options('*', cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use('/message', messageRoutes);
app.use('/registration', rigistrationRoutes);
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);


app.use((req, res, next) => {
    const err = new Error('Page not found');
    err.status = 404;
    next(err)
});
app.use((err, req, res, next) => {
    res
        .status(err.status || StatusCodes.INTERNAL_SERVER_ERROR)
        .json({
            message: err.message || getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
            code: err.code,
        });
});

http.listen(PORT, err => {
    if (err) console.error(err);
    console.log(`Server listen on port ${PORT}`);
});