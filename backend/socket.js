const rooms = {};
const roomStates = {};

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('joinRoom', ({ roomId, username }) => {
            socket.join(roomId);
            console.log(`${username} (${socket.id}) joined room: ${roomId}`);

            if (!rooms[roomId]) {
                rooms[roomId] = { players: [], drawings: [], countdownStarted: false };
                roomStates[roomId] = { started: false };
            }

            if (roomStates[roomId].started) {
                socket.emit('spectator', { message: 'The game has already started, you are now a spectator.' });
            } else {
                rooms[roomId].players.push({ id: socket.id, username });

                socket.emit('loadDrawings', rooms[roomId].drawings);

                socket.to(roomId).emit('message', { username: 'System', message: `${username} has joined the room!` });

                if (rooms[roomId].players.length >= 2 && !rooms[roomId].countdownStarted) {
                    rooms[roomId].countdownStarted = true;
                    let countdown = 20;
                    io.to(roomId).emit('countdown', { countdown });

                    const interval = setInterval(() => {
                        countdown -= 1;
                        io.to(roomId).emit('countdown', { countdown });

                        if (countdown === 0) {
                            clearInterval(interval);
                            roomStates[roomId].started = true;
                            io.to(roomId).emit('gameStart', { message: 'The game has started!' });
                        }
                    }, 1000);
                }
            }
        });

        socket.on('drawing', (data) => {
            const { roomId, x, y, color } = data;
            if (rooms[roomId]) {
                rooms[roomId].drawings.push({ x, y, color });
                socket.to(roomId).emit('drawing', { x, y, color });
            }
        });

        socket.on('undo', (roomId) => {
            if (rooms[roomId] && rooms[roomId].drawings.length > 0) {
                rooms[roomId].drawings.pop();
                io.to(roomId).emit('loadDrawings', rooms[roomId].drawings);
            }
        });

        socket.on('chatMessage', (data) => {
            const { roomId, username, message } = data;
            if (rooms[roomId]) {
                io.to(roomId).emit('message', { username, message });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            for (const roomId in rooms) {
                const playerIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    const username = rooms[roomId].players[playerIndex].username;
                    rooms[roomId].players.splice(playerIndex, 1);
                    socket.to(roomId).emit('message', { username: 'System', message: `${username} has left the room.` });
                    break;
                }
            }
        });
    });
};