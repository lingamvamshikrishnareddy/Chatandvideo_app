const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const connectedPeers = new Set();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  connectedPeers.add(socket.id);

  socket.on('requestPeers', () => {
    const availablePeers = Array.from(connectedPeers).filter(id => id !== socket.id);
    socket.emit('peerList', availablePeers);
  });

  socket.on('offer', (offer, targetId) => {
    socket.to(targetId).emit('offer', offer, socket.id);
  });

  socket.on('answer', (answer, targetId) => {
    socket.to(targetId).emit('answer', answer);
  });

  socket.on('iceCandidate', (candidate, targetId) => {
    socket.to(targetId).emit('iceCandidate', candidate);
  });

  socket.on('chatMessage', (message) => {
    io.emit('chatMessage', message);
  });

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
  });

  socket.on('hangup', (roomId) => {
    io.to(roomId).emit('callEnded');
    // Additional logic to clean up the room if needed
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    connectedPeers.delete(socket.id);
    io.emit('peerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
