const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const {port} = require('./constants/port');

const {messageRoutes, rigistrationRoutes, authRoutes, usersRoutes} = require('./routes');
const {socketService} = require('./socketService');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

mongoose.connect('mongodb://localhost:27017/myChat', { useNewUrlParser: true, useUnifiedTopology:true});

io.on('connection', async socket => {
    console.log('user connected ');
    await socketService.Socket(socket, io);
});

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
        .status(err.status || 500)
        .json({
            success: false,
            message: err.message || 'Unknown Error',
            controller: err.controller
        })
});

http.listen(port, err => {
    if (err) console.error(err);
    console.log(`Server listen on port ${port}`);
});