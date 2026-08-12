import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Ruta raíz que sirve tu vista principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta dinámica para el visor de documentos VIP
app.get('/documento/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'public_viewer.html'));
});

io.on('connection', (socket) => {
    let currentToken = null;
    let currentUserId = null;

    // Unirse a la sala del documento para anotaciones y sincronización en tiempo real[cite: 4]
    socket.on('join_document', (token) => {
        currentToken = token;
        socket.join(token);
    });

    // Sincronización de anotaciones en el lienzo[cite: 4]
    socket.on('send_comment', (data) => {
        socket.to(data.token).emit('new_comment_received', data.commentData);
    });

    // ==========================================
    // SINCRONIZACIÓN EN TIEMPO REAL (DIBUJOS, CURSORES Y SCROLL)
    // ==========================================
    socket.on('draw_action', (data) => {
        socket.to(data.token).emit('draw_action', data);
    });

    socket.on('cursor_sync', (data) => {
        currentUserId = data.userId;
        socket.to(data.token).emit('cursor_sync', data);
    });

    socket.on('scroll_sync', (data) => {
        socket.to(data.token).emit('scroll_sync', data);
    });

    // ==========================================
    // NUEVOS EVENTOS: CHAT FLOTANTE INDEPENDIENTE
    // ==========================================
    socket.on('send_chat_message', (data) => {
        socket.to(data.token).emit('new_chat_message', data.chatMessage);
    });

    // ==========================================
    // NUEVOS EVENTOS: SEÑALIZACIÓN WEBRTC (VOZ)
    // ==========================================
    socket.on('join_voice_room', (token) => {
        socket.join(token + '_voice');
        socket.to(token + '_voice').emit('peer_joined_voice');
    });

    socket.on('leave_voice_room', (token) => {
        socket.leave(token + '_voice');
    });

    socket.on('voice_offer', ({ token, offer }) => {
        socket.to(token + '_voice').emit('voice_offer', offer);
    });

    socket.on('voice_answer', ({ token, answer }) => {
        socket.to(token + '_voice').emit('voice_answer', answer);
    });

    socket.on('voice_candidate', ({ token, candidate }) => {
        socket.to(token + '_voice').emit('voice_candidate', candidate);
    });

    // Manejo de desconexión para limpiar cursores remotos
    socket.on('disconnect', () => {
        if (currentToken && currentUserId) {
            socket.to(currentToken).emit('user_disconnected', currentUserId);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor VIP corriendo en el puerto ${PORT}`);
});
