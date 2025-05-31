import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import {
  gamesRouter as originalGamesRouter, 
  usersRouter,
} from './routes/index.js'; 

import { verifyToken } from './middleware/jwtVerify.js'; 
import { query } from './db.js'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


const server = http.createServer(app);


export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

export const  userSocketMap = new Map(); 
const socketUserMap = new Map(); 

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('authenticateUser', (userId) => {
    userSocketMap.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);
    console.log(`User ${userId} authenticated with socket ${socket.id}`);
    socket.join(userId);
  });

  socket.on('disconnect', () => {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);
      console.log(`User ${userId} disconnected. Socket: ${socket.id}`);
    } else {
      console.log(`Socket disconnected: ${socket.id}`);
    }
  });

 
  socket.on('joinGameRoom', (gameId) => {
    if (gameId) {
      socket.join(gameId);
      console.log(`Socket ${socket.id} joined game room ${gameId}`);
    }
  });

  socket.on('leaveGameRoom', (gameId) => {
    if (gameId) {
      socket.leave(gameId);
      console.log(`Socket ${socket.id} left game room ${gameId}`);
    }
  });
});


app.use(cors({
  origin: process.env.FRONTEND_URL || '*', 
  credentials: true,
}));
app.use(express.json());

app.use('/games', originalGamesRouter); 
app.use('/users/protected', verifyToken, usersRouter);
app.use('/users', usersRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the couples app',
    appVersion: '1.0.0',
  });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
