from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('message')
def handle_message(data):
    emit('message', data, broadcast=True, include_self=False)

if __name__ == '__main__':
    print("Servidor corriendo en http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000)
