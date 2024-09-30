const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const routes = require('./routes/index');
const socketSetup = require('./socket');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/', routes);

socketSetup(io);

const PORT = 3001; //maybe add env configuration later
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});