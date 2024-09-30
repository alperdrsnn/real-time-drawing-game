const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const frontendPath = path.join(__dirname, '..', '..', 'frontend');

router.get('/', (req, res) => {
    res.sendFile('index.html', { root: frontendPath });
})

router.get('/create-room', (req, res) => {
    const roomId = uuidv4();
    res.redirect(`/room/${roomId}`);
});

router.get('/room/:roomId', (req, res) => {
    res.sendFile('room.html', { root: frontendPath });
});

module.exports = router;