const rooms = {};
const roomStates = {};
const wordList = require('./words.json');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('joinRoom', ({ roomId, username }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.username = username;
            console.log(`${username} (${socket.id}) joined room: ${roomId}`);

            if (!rooms[roomId]) {
                rooms[roomId] = {
                    players: [],
                    spectators: [],
                    drawings: [],
                    countdownStarted: false,
                    turnOrder: [],
                    currentTurnIndex: 0,
                    currentDrawer: null,
                    currentWord: null,
                    scores: {},
                    round: 0,
                    guessedUsers: [],
                    drawingCountdown: 60,
                    drawingInterval: null
                };
                roomStates[roomId] = { started: false };
            }

            const room = rooms[roomId];

            if (roomStates[roomId].started) {
                room.spectators.push({ id: socket.id, username });
                socket.emit('spectator', { message: 'The game has already started, you are now a spectator.' });
            } else {
                room.players.push({ id: socket.id, username });
                room.scores[socket.id] = 0;
                room.turnOrder.push(socket.id);

                socket.emit('loadDrawings', room.drawings);
                socket.to(roomId).emit('message', { username: 'System', message: `${username} has joined the room!` });

                if (room.players.length < 2 && !room.countdownStarted) {
                    io.to(roomId).emit('loading');
                } else if (room.players.length >= 2 && !room.countdownStarted) {
                    room.countdownStarted = true;
                    let countdown = 20;
                    io.to(roomId).emit('countdown', { countdown });

                    const interval = setInterval(() => {
                        countdown -= 1;
                        io.to(roomId).emit('countdown', { countdown });

                        if (countdown === 0) {
                            clearInterval(interval);
                            roomStates[roomId].started = true;
                            io.to(roomId).emit('gameStart', { message: 'The game has started!' });
                            startNextTurn(roomId, io); //Start the first turn
                        }
                    }, 1000);
                }
            }
        });

        const startNextTurn = (roomId, io) => {
            const room = rooms[roomId];
            if (!room) return;

            if (room.round >= 2) {
                const scoresWithUsernames = room.players.map(player => ({
                    username: player.username,
                    score: room.scores[player.id]
                }));
                io.to(roomId).emit('gameOver', { scores: scoresWithUsernames });
                return;
            }

            const currentDrawerId = room.turnOrder[room.currentTurnIndex];
            const currentDrawer = room.players.find(p => p.id === currentDrawerId);
            room.currentDrawer = currentDrawer;

            const options = getRandomWords(3);
            room.currentWordOptions = options;
            io.to(currentDrawerId).emit('wordOptions', { options });

            let selectionCountdown = 20; 
            io.to(roomId).emit('turnInfo', { message: `${currentDrawer.username} is choosing a word...` });

            room.selectionTimeout = setTimeout(() => {
                const randomWord = room.currentWordOptions[Math.floor(Math.random() * room.currentWordOptions.length)];
                room.currentWord = randomWord;
                io.to(currentDrawerId).emit('yourTurn', { word: randomWord });
                io.to(roomId).emit('wordSelected', { drawer: currentDrawer.username });

                startDrawingPhase(roomId, io);
            }, selectionCountdown * 1000);
        };

        const startDrawingPhase = (roomId, io) => {
            const room = rooms[roomId];
            if (!room) return;

            room.guessedUsers = [];
            room.drawings = [];

            io.to(roomId).emit('clearCanvas');
            io.to(roomId).emit('drawingPhase', { message: `${room.currentDrawer.username} is drawing!`, drawer: room.currentDrawer.username });

            room.drawingCountdown = 60;
            io.to(roomId).emit('drawingCountdown', { countdown: room.drawingCountdown });

            room.drawingInterval = setInterval(() => {
                room.drawingCountdown -= 1;
                io.to(roomId).emit('drawingCountdown', { countdown: room.drawingCountdown });

                if (room.drawingCountdown === 0) {
                    clearInterval(room.drawingInterval);
                    io.to(roomId).emit('turnEnded', { message: 'Time is up, it\'s the next player\'s turn!' });
                    proceedToNextTurn(roomId, io);
                }
            }, 1000);
        };

        const proceedToNextTurn = (roomId, io) => {
            const room = rooms[roomId];
            if (!room) return;

            room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;

            if (room.currentTurnIndex === 0) {
                room.round += 1;
            }

            startNextTurn(roomId, io);
        };

        const getRandomWords = (count) => {
            const shuffled = wordList.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        };

        // Middleware to check if user is a player and the game has started
        const isPlayerAndGameStarted = (socket, roomId) => {
            const room = rooms[roomId];
            const state = roomStates[roomId];
            if (!room || !state || !state.started) {
                return false;
            }
            return room.players.some(player => player.id === socket.id);
        };

        socket.on('wordChosen', ({ chosenWord }) => {
            const roomId = socket.roomId;
            const room = rooms[roomId];
            if (!room) return;

            if (socket.id !== room.currentDrawer.id) {
                socket.emit('error', { message: 'You are not the current drawer.' });
                return;
            }

            clearTimeout(room.selectionTimeout);

            if (chosenWord && room.currentWordOptions && room.currentWordOptions.includes(chosenWord)) {
                room.currentWord = chosenWord;
            } else {
                room.currentWord = room.currentWordOptions[Math.floor(Math.random() * room.currentWordOptions.length)];
            }

            io.to(socket.id).emit('yourTurn', { word: room.currentWord });
            io.to(roomId).emit('wordSelected', { drawer: room.currentDrawer.username });

            startDrawingPhase(roomId, io);
        });

        socket.on('drawing', (data) => {
            const { roomId, x, y, lastX, lastY, color } = data;
            const room = rooms[roomId];

            //Some validation
            if (typeof roomId !== "string" || typeof x !== 'number' || typeof y !== 'number' || typeof color !== 'string') {
                console.log(`Invalid drawing data from ${socket.id}`);
                socket.emit('error', { message: 'Invalid drawing data.' });
                return;
            }

            if (isPlayerAndGameStarted(socket, roomId)) {
                if (room.currentDrawer.id === socket.id) {
                    room.drawings.push({ x, y, lastX, lastY, color });
                    socket.to(roomId).emit('drawing', { x, y, lastX, lastY, color });
                } else {
                    socket.emit('error', { message: 'It is not your turn to draw.' });
                }
            } else {
                console.log(`Unauthorized drawing attempt by ${socket.id} in room ${roomId}`);
            }
        });

        socket.on('undo', (roomId) => {
            const room = rooms[roomId];

            if (isPlayerAndGameStarted(socket, roomId)) {
                if (room.currentDrawer.id === socket.id && room.drawings.length > 0) {
                    room.drawings.pop();
                    io.to(roomId).emit('loadDrawings', room.drawings);
                } else {
                    socket.emit('error', { message: 'You cannot undo at this moment.' });
                }
            } else {
                console.log(`Unauthorized undo attempt by ${socket.id} in room ${roomId}`);
            }
        });

        socket.on('chatMessage', (data) => {
            const { roomId, username, message } = data;
            const room = rooms[roomId];

            if (room && room.currentWord && message.toLowerCase() === room.currentWord.toLowerCase()) {
                if (!room.guessedUsers.includes(socket.id)) {
                    room.guessedUsers.push(socket.id);
                    const order = room.guessedUsers.length;
                    const timeBonus = Math.ceil(room.drawingCountdown / 10);
                    const points = 10 + timeBonus - (order - 1);
                    room.scores[socket.id] += points;

                    io.to(roomId).emit('message', { username: 'System', message: `${username} guessed correctly and earned ${points} points!` });

                    const scoresWithUsernames = room.players.map(player => ({
                        username: player.username,
                        score: room.scores[player.id]
                    }));
                    io.to(roomId).emit('updateScores', { scores: scoresWithUsernames });

                    if (room.guessedUsers.length === room.players.length - 1) {
                        io.to(roomId).emit('message', { username: 'System', message: 'All players have guessed the word!' });
                        clearInterval(room.drawingInterval);
                        proceedToNextTurn(roomId, io);
                    }

                    return;
                }
            }

            if (room) {
                io.to(roomId).emit('message', { username, message });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            for (const roomId in rooms) {
                const room = rooms[roomId];

                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    const username = room.players[playerIndex].username;
                    room.players.splice(playerIndex, 1);
                    room.turnOrder = room.turnOrder.filter(id => id !== socket.id);
                    delete room.scores[socket.id];
                    socket.to(roomId).emit('message', { username: 'System', message: `${username} has left the room.` });

                    //Check if the disconnecting user is the current drawer
                    if (room.currentDrawer && room.currentDrawer.id === socket.id) {
                        clearInterval(room.drawingInterval);
                        io.to(roomId).emit('message', { username: 'System', message: 'The drawer has disconnected. Moving to the next turn.' });
                        proceedToNextTurn(roomId, io);
                    }

                    break;
                }

                const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
                if (spectatorIndex !== -1) {
                    const username = room.spectators[spectatorIndex].username;
                    room.spectators.splice(spectatorIndex, 1);
                    io.to(roomId).emit('message', { username: 'System', message: `${username} has left the room.` });
                    break;
                }
            }
        });
    });
};