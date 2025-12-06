from quart import Quart, render_template, request
import socketio
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crear aplicación Quart (compatible async con Python 3.13)
app = Quart(__name__)
app.config['SECRET_KEY'] = 'tu-secret-key-aqui'

# Crear servidor Socket.IO con modo ASGI (sin gevent/eventlet)
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Wrap Quart app con Socket.IO
app = socketio.ASGIApp(sio, app)

# Diccionario para rastrear clientes conectados
connected_clients = {}

@app.route('/')
async def index():
    return await render_template('index.html')

@sio.event
async def connect(sid, environ):
    connected_clients[sid] = True
    logger.info(f'✅ Cliente conectado: {sid}')
    logger.info(f'📊 Total de clientes conectados: {len(connected_clients)}')
    
    # Notificar a todos cuántos están conectados
    await sio.emit('user_count', {'count': len(connected_clients)})

@sio.event
async def disconnect(sid):
    if sid in connected_clients:
        del connected_clients[sid]
    logger.info(f'❌ Cliente desconectado: {sid}')
    logger.info(f'📊 Total de clientes conectados: {len(connected_clients)}')
    
    # Notificar desconexión
    await sio.emit('user_disconnected', {'sid': sid}, skip_sid=sid)
    await sio.emit('user_count', {'count': len(connected_clients)})

@sio.event
async def message(sid, data):
    logger.info(f'📨 Mensaje recibido de {sid}: {list(data.keys())}')
    
    # Registrar tipo de mensaje
    if 'offer' in data:
        logger.info(f'🔵 OFFER recibido de {sid}')
    elif 'answer' in data:
        logger.info(f'🟢 ANSWER recibido de {sid}')
    elif 'iceCandidate' in data:
        logger.info(f'🧊 ICE Candidate recibido de {sid}')
    elif 'hangup' in data:
        logger.info(f'📞 HANGUP recibido de {sid}')
    
    # Reenviar a todos excepto al emisor
    await sio.emit('message', data, skip_sid=sid)
    logger.info(f'📤 Mensaje reenviado a otros clientes')

@sio.event
async def error(sid, e):
    logger.error(f'❗ Error en socket {sid}: {str(e)}')

if __name__ == '__main__':
    import hypercorn.asyncio
    import hypercorn.config
    
    config = hypercorn.config.Config()
    config.bind = ["0.0.0.0:5000"]
    logger.info("🚀 Servidor corriendo en http://localhost:5000")
    
    import asyncio
    asyncio.run(hypercorn.asyncio.serve(app, config))
