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
const scoreTable = document.getElementById('scoreTable');
const wordDisplay = document.getElementById('wordDisplay');

canvas.width = 800;
canvas.height = 600;

let currentColor = colorPicker.value;
let drawing = false;
const roomId = window.location.pathname.split('/').pop();
let username = '';
let isSpectator = false;
let canDraw = false;
let currentWord = null;
let wordSelectionTimeout = null;

const wordOptionsContainer = document.createElement('div');
wordOptionsContainer.id = 'wordOptionsContainer';
document.body.appendChild(wordOptionsContainer);

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
});

socket.on('spectator', (data) => {
    spectatorMessage.textContent = data.message;
    spectatorMessage.classList.remove('hidden');
    isSpectator = true;
    disableDrawingTools();
})

socket.on('turnInfo', (data) => {
    alert(data.message);
});

socket.on('wordOptions', ({ options }) => {
    if (isSpectator) return;

    wordOptionsContainer.innerHTML = '<h3>Choose a Word:</h3>';
    options.forEach(word => {
        const button = document.createElement('button');
        button.textContent = word;
        button.addEventListener('click', () => {
            socket.emit('wordChosen', { chosenWord: word });
            wordOptionsContainer.innerHTML = '';
        });
        wordOptionsContainer.appendChild(button);
    });

    wordSelectionTimeout = setTimeout(() => {
        wordOptionsContainer.innerHTML = '';
    }, 20000);
});

socket.on('yourTurn', ({ word }) => {
    showWordSelection(word);
});

socket.on('drawingPhase', ({ message, drawer }) => {
    alert(message);
    if (username === drawer) {
        canDraw = true;
        enableDrawingTools();
    } else {
        canDraw = false;
        disableDrawingTools();
    }
});

socket.on('drawingCountdown', ({ countdown }) => {
    countdownElement.classList.remove('hidden');
    countdownElement.textContent = `Draw time: ${countdown} seconds`;
});

socket.on('turnEnded', ({ message }) => {
    alert(message);
    countdownElement.classList.add('hidden');
    canDraw = false;
    disableDrawingTools();
    wordDisplay.textContent = '';
});

socket.on('gameOver', ({ scores }) => {
    let scoreHtml = '<h2>Game Over! Scores:</h2><ul>';
    scores.forEach(({ username, score }) => {
        scoreHtml += `<li>${username}: ${score}</li>`;
    });
    scoreHtml += '</ul>';
    scoreTable.innerHTML = scoreHtml;
});

socket.on('wordSelected', ({ drawer }) => {
    if (username !== drawer) {
        alert(`${drawer} has selected a word.`);
    }
});

socket.on('updateScores', ({ scores }) => {
    let scoreHtml = '<h2>Scoreboard</h2><ul>';
    scores.forEach(({ username, score }) => {
        scoreHtml += `<li>${username}: ${score}</li>`;
    });
    scoreHtml += '</ul>';
    scoreTable.innerHTML = scoreHtml;
});

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

let lastX = 0;
let lastY = 0;

const startDrawing = (e) => {
    if (!canDraw) return;
    drawing = true;
    lastX = e.clientX - canvas.offsetLeft;
    lastY = e.clientY - canvas.offsetTop;
};

const endDrawing = () => {
    if (!canDraw) return;
    drawing = false;
};

const draw = (e) => {
    if (!drawing) return;
    const x = e.clientX - canvas.offsetLeft;
    const y = e.clientY - canvas.offsetTop;

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();

    socket.emit('drawing', {
        roomId,
        x,
        y,
        lastX,
        lastY,
        color: currentColor
    });

    lastX = x;
    lastY = y;
};

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('mouseout', endDrawing);
canvas.addEventListener('mousemove', draw);

socket.on('drawing', (data) => {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.closePath();
});

socket.on('loadDrawings', (drawings) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach(({ x, y, lastX, lastY, color }) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();
    });
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

socket.on('error', (data) => {
    alert(data.message);
})

function showWordSelection(word) {
    wordDisplay.textContent = `Your word: ${word}`;
}

socket.on('message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${data.username}: ${data.message}`;
    chatMessages.appendChild(messageElement);

    chatMessages.scrollTop = chatMessages.scrollHeight;
});