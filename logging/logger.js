// Filename: logger.js

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

io.on('connection', (socket) => {
    console.log('User Connected');
    socket.emit('log1', 'Connection established');
    socket.emit('log2', 'Connection established');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Logger.html'));
});

server.listen(3000, async () => {
    console.log('WebSocket server listening on port 3000');
    try {
        const open = (await import('open')).default;
        await open('http://localhost:3000');
    } catch (err) {
        console.error('Failed to open URL:', err);
    }
});

module.exports = io;
