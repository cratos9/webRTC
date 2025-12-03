const socket = io();
let localStream;
let peerConnection;
const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");

const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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
    try {
      await peerConnection.addIceCandidate(message.iceCandidate);
    } catch (e) {
      console.error("Error agregando ICE:", e);
    }
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
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

async function createOffer() {
  await createConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("message", { offer });
  // UI
  if (startBtn) startBtn.disabled = true;
  if (hangupBtn) hangupBtn.disabled = false;
}

async function createAnswer(offer) {
  await createConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("message", { answer });
}

// Finalizar la llamada: cerrar PeerConnection, detener tracks locales y notificar al otro peer
function colgar() {
  console.log("Colgando la llamada...");
  try {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      // limpiar fuente del video local
      const lv = document.getElementById("localVideo");
      if (lv) lv.srcObject = null;
    }
    // notificar al servidor/peer que colgamos (opcional)
    socket.emit("message", { hangup: true });
  } catch (e) {
    console.error("Error al colgar:", e);
  } finally {
    // UI
    if (startBtn) startBtn.disabled = false;
    if (hangupBtn) hangupBtn.disabled = true;
    const rv = document.getElementById("remoteVideo");
    if (rv) rv.srcObject = null;
  }
}

startVideo();
