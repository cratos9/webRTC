// Configuración de Socket.IO con reconexión
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling']
});

let localStream;
let peerConnection;
const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");

// Servidores STUN/TURN para conectividad
const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ],
  iceCandidatePoolSize: 10
};

// Logs de conexión Socket.IO
socket.on('connect', () => {
  console.log('✅ Conectado al servidor Socket.IO');
  console.log('🆔 Socket ID:', socket.id);
  console.log('🔌 Transporte usado:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado del servidor:', reason);
  if (reason === 'io server disconnect') {
    console.log('🔄 El servidor desconectó, reconectando...');
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  console.error('❗ Error de conexión:', error);
  console.log('🔄 Intentando reconectar...');
});

socket.on('user_count', (data) => {
  console.log('👥 Usuarios conectados:', data.count);
});

socket.on('user_disconnected', (data) => {
  console.log('👋 Usuario desconectado:', data.sid);
});

async function startVideo() {
  try {
    console.log('🎥 Solicitando acceso a cámara y micrófono...');
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    });
    document.getElementById("localVideo").srcObject = localStream;
    console.log('✅ Stream local obtenido:', localStream.getTracks().map(t => `${t.kind}: ${t.label}`));
  } catch (error) {
    console.error('❌ Error obteniendo media:', error);
    alert('Error al acceder a cámara/micrófono: ' + error.message);
  }
}

socket.on("message", async (message) => {
  console.log('📨 Mensaje recibido:', Object.keys(message));
  
  try {
    if (message.offer) {
      console.log('🔵 OFFER recibido');
      await createAnswer(message.offer);
    } else if (message.answer) {
      console.log('🟢 ANSWER recibido');
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        console.log('✅ Remote description (answer) establecida');
      } else {
        console.error('❌ No hay peerConnection para el answer');
      }
    } else if (message.iceCandidate) {
      console.log('🧊 ICE Candidate recibido:', message.iceCandidate.candidate);
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.iceCandidate));
        console.log('✅ ICE Candidate agregado');
      } else {
        console.warn('⚠️ No se puede agregar ICE: remoteDescription no establecida aún');
      }
    } else if (message.hangup) {
      console.log('📞 Peer remoto colgó');
      colgar();
    }
  } catch (e) {
    console.error('❌ Error procesando mensaje:', e);
  }
});

async function createConnection() {
  console.log('🔗 Creando PeerConnection...');
  peerConnection = new RTCPeerConnection(servers);
  
  // Logs de estado de conexión
  peerConnection.onconnectionstatechange = () => {
    console.log('🔄 Connection state:', peerConnection.connectionState);
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
  };
  
  peerConnection.onicegatheringstatechange = () => {
    console.log('📡 ICE gathering state:', peerConnection.iceGatheringState);
  };
  
  peerConnection.onsignalingstatechange = () => {
    console.log('📶 Signaling state:', peerConnection.signalingState);
  };
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('🧊 Enviando ICE candidate:', event.candidate.candidate);
      socket.emit("message", { iceCandidate: event.candidate });
    } else {
      console.log('✅ Todos los ICE candidates enviados');
    }
  };
  
  peerConnection.ontrack = (event) => {
    console.log('🎬 Track remoto recibido:', event.track.kind);
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      console.log('✅ Stream remoto conectado al video');
    }
  };
  
  // Agregar tracks locales
  localStream.getTracks().forEach(track => {
    console.log('➕ Agregando track local:', track.kind);
    peerConnection.addTrack(track, localStream);
  });
  
  console.log('✅ PeerConnection creada');
}

async function createOffer() {
  try {
    console.log('🎬 Iniciando llamada (creando offer)...');
    await createConnection();
    
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    console.log('📝 Offer creado:', offer.type);
    
    await peerConnection.setLocalDescription(offer);
    console.log('✅ Local description establecida');
    
    socket.emit("message", { offer });
    console.log('📤 Offer enviado al servidor');
    
    // UI
    if (startBtn) startBtn.disabled = true;
    if (hangupBtn) hangupBtn.disabled = false;
  } catch (error) {
    console.error('❌ Error creando offer:', error);
    alert('Error al iniciar llamada: ' + error.message);
  }
}

async function createAnswer(offer) {
  try {
    console.log('🎬 Respondiendo llamada (creando answer)...');
    await createConnection();
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('✅ Remote description (offer) establecida');
    
    const answer = await peerConnection.createAnswer();
    console.log('📝 Answer creado:', answer.type);
    
    await peerConnection.setLocalDescription(answer);
    console.log('✅ Local description establecida');
    
    socket.emit("message", { answer });
    console.log('📤 Answer enviado al servidor');
    
    // UI
    if (startBtn) startBtn.disabled = true;
    if (hangupBtn) hangupBtn.disabled = false;
  } catch (error) {
    console.error('❌ Error creando answer:', error);
    alert('Error al responder llamada: ' + error.message);
  }
}

// Finalizar la llamada
function colgar() {
  console.log("📞 Colgando la llamada...");
  try {
    if (peerConnection) {
      peerConnection.close();
      console.log('✅ PeerConnection cerrada');
      peerConnection = null;
    }
    
    // No detener tracks locales para poder reiniciar llamada
    // Solo limpiar video remoto
    const rv = document.getElementById("remoteVideo");
    if (rv) rv.srcObject = null;
    
    // Notificar al servidor/peer que colgamos
    socket.emit("message", { hangup: true });
    console.log('📤 Notificación de hangup enviada');
  } catch (e) {
    console.error("❌ Error al colgar:", e);
  } finally {
    // UI
    if (startBtn) startBtn.disabled = false;
    if (hangupBtn) hangupBtn.disabled = true;
  }
}

// Iniciar video al cargar
console.log('🚀 Iniciando aplicación WebRTC');
startVideo();
