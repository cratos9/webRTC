const socket = io();
let localStream;
let peerConnection;

const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

async function startVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}

socket.on("message", async (message) => {
  if (message.offer) {
    await createAnswer(message.offer);
  } else if (message.answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
  } else if (message.iceCandidate) {
    await peerConnection.addIceCandidate(message.iceCandidate).catch(e => console.error(e));
  } else if (message.hangup) {
    colgar(false);
  }
});

async function createConnection() {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("message", { iceCandidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };

  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );
}

async function createOffer() {
  await createConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("message", { offer });

  startBtn.disabled = true;
  hangupBtn.disabled = false;
}

async function createAnswer(offer) {
  await createConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("message", { answer });

  startBtn.disabled = true;
  hangupBtn.disabled = false;
}

function colgar(notify = true) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    document.getElementById("localVideo").srcObject = null;
  }

  document.getElementById("remoteVideo").srcObject = null;
  startBtn.disabled = false;
  hangupBtn.disabled = true;

  if (notify) socket.emit("message", { hangup: true });
}

startVideo();
