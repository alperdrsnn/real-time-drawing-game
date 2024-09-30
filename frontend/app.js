const socket = io();

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const colorPicker = document.getElementById('colorPicker');
const undoBtn = document.getElementById('undoBtn');
const countdownElement = document.getElementById('countdown');
const countdownNumberElement = document.getElementById('countdownNumber');
const spectatorMessage = document.getElementById('spectatorMessage');

canvas.width = 800;
canvas.height = 600;

let currentColor = colorPicker.value;
let drawing = false;
const roomId = window.location.pathname.split('/').pop();
let username = '';
let isSpectator = false;
let canDraw = false;

const usernamePrompt = document.getElementById('usernamePrompt');
const joinRoomButton = document.getElementById('joinRoom');
const gameContainer = document.getElementById('gameContainer');

joinRoomButton.addEventListener('click', () => {
    username = document.getElementById('username').value.trim();
    if (username === '') {
        alert('Please enter username');
        return;
    }

    socket.emit('joinRoom', { roomId, username });

    usernamePrompt.classList.add('hidden');
    gameContainer.classList.remove('hidden');
});

socket.on('countdown', (data) => {
    countdownElement.classList.remove('hidden');
    countdownNumberElement.textContent = data.countdown;
});

socket.on('gameStart', () => {
    countdownElement.classList.add('hidden');
    if (!isSpectator) {
        canDraw = true;
        enableDrawingTools();
    }
});

socket.on('spectator', (data) => {
    spectatorMessage.textContent = data.message;
    spectatorMessage.classList.remove('hidden');
    isSpectator = true;
    disableDrawingTools();
})

function enableDrawingTools() {
    canvas.style.pointerEvents = 'auto';
    colorPicker.disabled = false;
    undoBtn.disabled = false;
}

function disableDrawingTools() {
    canvas.style.pointerEvents = 'none';
    colorPicker.disabled = true;
    undoBtn.disabled = true;
}

const startDrawing = (e) => {
    if (!canDraw) return;
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
}

const endDrawing = () => {
    if (!canDraw) return;
    drawing = false;
}

const draw = (e) => {
    if (!drawing) return;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    ctx.lineTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);

    socket.emit('drawing', {
        roomId,
        x: e.clientX - canvas.offsetLeft,
        y: e.clientY - canvas.offsetTop,
        color: currentColor
    });
};

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('mouseout', endDrawing);
canvas.addEventListener('mousemove', draw);

socket.on('drawing', (data) => {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on('loadDrawings', (drawings) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach(({ x, y, color }, index) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        if (index === 0) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    });
});

sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message === '') return;

    socket.emit('chatMessage', { roomId, username, message });
    chatInput.value = '';
});

undoBtn.addEventListener('click', () => {
    if (!canDraw) return;
    socket.emit('undo', roomId);
});

colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

socket.on('message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${data.username}: ${data.message}`;
    chatMessages.appendChild(messageElement);

    chatMessages.scrollTop = chatMessages.scrollHeight;
});