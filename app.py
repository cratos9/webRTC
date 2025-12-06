from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu-secret-key-aqui'

# Configuración para producción con eventlet
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Diccionario para rastrear clientes conectados
connected_clients = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    connected_clients[client_id] = True
    logger.info(f'✅ Cliente conectado: {client_id}')
    logger.info(f'📊 Total de clientes conectados: {len(connected_clients)}')
    
    # Notificar a todos cuántos están conectados
    emit('user_count', {'count': len(connected_clients)}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    if client_id in connected_clients:
        del connected_clients[client_id]
    logger.info(f'❌ Cliente desconectado: {client_id}')
    logger.info(f'📊 Total de clientes conectados: {len(connected_clients)}')
    
    # Notificar desconexión
    emit('user_disconnected', {'sid': client_id}, broadcast=True, include_self=False)
    emit('user_count', {'count': len(connected_clients)}, broadcast=True)

@socketio.on('message')
def handle_message(data):
    client_id = request.sid
    logger.info(f'📨 Mensaje recibido de {client_id}: {list(data.keys())}')
    
    # Registrar tipo de mensaje
    if 'offer' in data:
        logger.info(f'🔵 OFFER recibido de {client_id}')
    elif 'answer' in data:
        logger.info(f'🟢 ANSWER recibido de {client_id}')
    elif 'iceCandidate' in data:
        logger.info(f'🧊 ICE Candidate recibido de {client_id}')
    elif 'hangup' in data:
        logger.info(f'📞 HANGUP recibido de {client_id}')
    
    # Reenviar a todos excepto al emisor
    emit('message', data, broadcast=True, include_self=False)
    logger.info(f'📤 Mensaje reenviado a otros clientes')

@socketio.on('error')
def handle_error(e):
    logger.error(f'❗ Error en socket: {str(e)}')

if __name__ == '__main__':
    logger.info("🚀 Servidor corriendo en http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
