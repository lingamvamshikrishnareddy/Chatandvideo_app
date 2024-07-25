const socket = io();

const chatBox = document.getElementById('chat-box');
const usernameInput = document.getElementById('username');
const messageInput = document.getElementById('message');
const sendButton = document.getElementById('send-button');
const callButton = document.getElementById('call-button');
const hangupButton = document.getElementById('hangup-button');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let localStream;
let peerConnection;
let targetSocketId;
let currentRoomId;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

// Function to generate unique room ID
function generateUniqueRoomId() {
  return `room-${Math.random().toString(36).substr(2, 9)}`;
}

sendButton.addEventListener('click', () => {
  const username = usernameInput.value;
  const message = messageInput.value;
  if (username && message) {
    socket.emit('chatMessage', { username, message });
    messageInput.value = '';
  }
});

socket.on('chatMessage', (data) => {
  const messageElement = document.createElement('div');
  messageElement.textContent = `${data.username}: ${data.message}`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
});

callButton.addEventListener('click', () => {
  currentRoomId = generateUniqueRoomId();
  socket.emit('joinRoom', currentRoomId);
  socket.emit('requestPeers');
});

socket.on('peerList', async (peers) => {
  if (peers.length > 0) {
    targetSocketId = peers[0];
    await startCall();
  } else {
    alert('No other peers available');
  }
});

async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('iceCandidate', event.candidate, targetSocketId);
      }
    };

    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer, targetSocketId);

    callButton.style.display = 'none';
    hangupButton.style.display = 'block';
  } catch (error) {
    console.error('Error starting call:', error);
    alert('Failed to start call. Please make sure your camera and microphone are available.');
  }
}

socket.on('offer', async (offer, senderSocketId) => {
  try {
    targetSocketId = senderSocketId;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('iceCandidate', event.candidate, targetSocketId);
      }
    };

    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, targetSocketId);

    callButton.style.display = 'none';
    hangupButton.style.display = 'block';
  } catch (error) {
    console.error('Error handling offer:', error);
    alert('Failed to start call. Please make sure your camera and microphone are available.');
  }
});

socket.on('answer', async (answer) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Error handling answer:', error);
  }
});

socket.on('iceCandidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
});

hangupButton.addEventListener('click', endCall);

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
  }

  remoteVideo.srcObject = null;

  hangupButton.style.display = 'none';
  callButton.style.display = 'block';

  socket.emit('hangup', currentRoomId);
  targetSocketId = null;
}

socket.on('hangup', endCall);

socket.on('peerDisconnected', (disconnectedPeerId) => {
  if (disconnectedPeerId === targetSocketId) {
    endCall();
  }
});
