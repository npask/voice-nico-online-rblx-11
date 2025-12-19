// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {}; // socket.id -> { name, position }

app.use(express.static("public"));

io.on("connection", socket => {
  console.log("🔗 User connected:", socket.id);

  socket.on("join", name => {
    players[socket.id] = { name, position: { x:0,y:0,z:0 } };
    console.log("➕ User joined:", socket.id);
    // Sag allen anderen, dass ein neuer User da ist
    socket.broadcast.emit("user-joined", socket.id);
    // Sag dem neuen User, wer schon da ist
    Object.keys(players).forEach(id => {
      if(id !== socket.id) socket.emit("user-joined", id);
    });
  });

  socket.on("updatePos", pos => {
    if(players[socket.id]) players[socket.id].position = pos;
  });

  socket.on("disconnect", () => {
    console.log("❌ User left:", socket.id);
    delete players[socket.id];
    socket.broadcast.emit("user-left", socket.id);
  });
});

// optional: alle 100ms alle Positionen an alle senden
setInterval(()=>{
  io.emit("players", players);
},100);

server.listen(3000, ()=>console.log("Server running on port 3000"));
