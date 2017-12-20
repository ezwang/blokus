#!/usr/bin/env node

var fs = require("fs");
var os = require("os");
var http = require("http");
var finalHandler = require("finalhandler");
var serveStatic = require("serve-static");
var uuid = require("node-uuid");
var serve = serveStatic("./");

var PORT = process.env.PORT || 1337;

var server = http.createServer(function(req, res) {
    var done = finalHandler(req, res);
    serve(req, res, done);
});

var io = require("socket.io")(server);

var users = {};
var rooms = {};
var queue = [];

function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function saveGame(roomid) {
    fs.appendFile("games.txt", JSON.stringify({ board: rooms[roomid].board, players: rooms[roomid].playerNames, date: new Date().toISOString() }) + os.EOL, function(err) {
        if (err) {
            console.log(err);
        }
    });
}

var color_encode = { "blue": 1, "yellow": 2, "red": 3, "green": 4 };

io.on("connection", function(socket) {
    console.log("New connection: " + socket.request.connection.remoteAddress);
    users[socket.id] = { socket: socket };
    socket.on("username", function(data) {
        console.log("Set username: " + socket.request.connection.remoteAddress + " -> " + data.username);
        users[socket.id].username = data.username;
        if (queue.length < 3) {
            queue.push(socket.id);
            socket.join("lobby");
            io.to("lobby").emit("find", { players: queue.length });
        }
        else {
            var roomid = uuid.v4();
            var players = [socket.id, queue.shift(), queue.shift(), queue.shift()];
            var colors = ["red", "green", "blue", "yellow"];
            var plr = {};
            var brd = [];
            for (var i = 0; i < 400; i++) {
                brd.push(0);
            }
            rooms[roomid] = { turn: 0, skipped: 0, color_order: ["blue", "yellow", "red", "green"], board: brd, players: players, playerNames: {} };
            shuffle(colors);
            var failed = false;
            players.forEach(function(p) {
                if (!users[p].socket || !users[p].socket.connected) {
                    failed = true;
                }
            });
            if (failed) {
                console.log("Matchmaking failed: " + players);
                players.forEach(function(p) {
                    if (users[p].socket.connected) {
                        queue.push(p);
                    }
                });
                delete rooms[roomid];
                return;
            }
            players.forEach(function(p) {
                users[p].socket.leave("lobby");
                users[p].socket.join(roomid);
                users[p].room = roomid;
                users[p].color = colors.pop();
                plr[users[p].color] = users[p].username;
                rooms[roomid].playerNames[users[p].color] = users[p].username;
            });
            players.forEach(function(p) {
                users[p].socket.emit("start", { id: roomid, color: users[p].color, players: plr });
            });
            io.to(roomid).emit("turn", { "pieces": [], "turn": rooms[roomid].color_order[rooms[roomid].turn] });
            console.log("Game started: " + roomid + " " + JSON.stringify(rooms[roomid].playerNames));
        }
    });
    socket.on("chat", function(data) {
        if (data.text) {
            if (users[socket.id].room) {
                if (/^\//.test(data.text)) {
                    console.log(users[socket.id].username + " tried command: " + data.text);
                    if (/^\/id/.test(data.text)) {
                        socket.emit("chat", { "username": "INFO", "color": "black", "text": users[socket.id].room });
                    }
                    else if (/^\/board/.test(data.text)) {
                        socket.emit("chat", { "username": "INFO", "color": "black", "text": rooms[users[socket.id].room].board });
                    }
                    else if (/^\/msg/.test(data.text)) {
                        var args = data.text.split(" ");
                        if (args.length >= 3) {
                            var color = args[1].toLowerCase();
                            var msg = args.splice(2).join(" ");
                            var sent = false;
                            rooms[users[socket.id].room].players.forEach(function(p) {
                                if (p in users && users[p].color == color && !sent) {
                                    users[p].socket.emit("chat", { "username": users[socket.id].username + " (private)", "color": users[socket.id].color, "text": msg });
                                    sent = true;
                                }
                            });
                            if (sent) {
                                socket.emit("chat", { "username": users[socket.id].username + " (private)", "color": users[socket.id].color, "text": msg });
                            }
                            else {
                                socket.emit("chat", { "username": "INFO", "color": "black", "text": "User not found!" });
                            }
                        }
                        else {
                            socket.emit("chat", { "username": "INFO", "color": "black", "text": "Usage: /msg <color> <message>" });
                        }
                    }
                    else {
                        socket.emit("chat", { "username": "INFO", "color": "black", "text": "Unknown command!" });
                    }
                }
                else {
                    console.log("[" + users[socket.id].room + "] " + users[socket.id].username + ": " + data.text);
                    io.to(users[socket.id].room).emit("chat", { "username": users[socket.id].username, "color": users[socket.id].color, "text": data.text });
                }
            }
            else {
                console.log("[lobby] " + users[socket.id].username + ": " + data.text);
                io.to("lobby").emit("chat", { "username": users[socket.id].username, "text": data.text });
            }
        }
    });
    socket.on("turn", function(data) {
        var roomid = users[socket.id].room;
        var color = users[socket.id].color;
        if (data.pieces) {
            for (var i = 0; i < data.pieces.length; i++) {
                var coord = data.pieces[i];
                if (coord[0] < 0 || coord[1] < 0) {
                    socket.emit("chat", { "username": "", "color": "black", "text": "Invalid piece placement!" });
                    data.pieces = [];
                    break;
                }
                if (coord[0] >= 20 || coord[1] >= 20) {
                    socket.emit("chat", { "username": "", "color": "black", "text": "Invalid piece placement!" });
                    data.pieces = [];
                    break;
                }
                if (rooms[roomid].board[coord[0]*20+coord[1]] != 0) {
                    socket.emit("chat", { "username": "", "color": "black", "text": "Invalid piece placement!" });
                    data.pieces = [];
                    break;
                }
            }
            data.pieces.forEach(function(v) {
                rooms[roomid].board[v[0]*20+v[1]] = color_encode[color];
            });
        }
        rooms[roomid].turn = (rooms[roomid].turn + 1) % rooms[roomid].color_order.length;
        if (data.pieces.length > 0) {
            rooms[roomid].skipped = 0;
        }
        else {
            rooms[roomid].skipped += 1;
        }
        if (rooms[roomid].skipped > 3) {
            // game over
            console.log("Game ended: " + roomid + " (no moves left)");
            saveGame(roomid);
            io.to(roomid).emit("end");
            delete rooms[roomid];
            return;
        }
        io.to(roomid).emit("turn", { "color": color, "pieces": data.pieces, "turn": rooms[roomid].color_order[rooms[roomid].turn] });
    });
    socket.on("disconnect", function() {
        console.log("Disconnect: " + (users[socket.id].username || socket.request.connection.remoteAddress));
        var index = queue.indexOf(socket.id);
        if (index > -1) {
            queue.splice(index, 1);
            io.to("lobby").emit("find", { players: queue.length });
        }
        // remove user from game
        if (users[socket.id].room) {
            io.to(users[socket.id].room).emit("chat", { "username": "", "color": users[socket.id].color, "text": users[socket.id].username + " disconnected" });
            var roomid = users[socket.id].room;
            var color = users[socket.id].color;
            var playerIndex = rooms[roomid].color_order.indexOf(color);
            if (playerIndex > -1) {
                rooms[roomid].color_order.splice(playerIndex, 1);
                if (rooms[roomid].color_order.length == 0) {
                    console.log("Game ended: " + roomid + " (all players left)");
                    saveGame(roomid);
                    delete rooms[roomid];
                }
                else if (playerIndex == rooms[roomid].turn) {
                    rooms[roomid].turn = (rooms[roomid].turn) % rooms[roomid].color_order.length;
                    io.to(roomid).emit("turn", { "color": color, "pieces": [], "turn": rooms[roomid].color_order[rooms[roomid].turn] });
                    console.log("Skipped turn to " + rooms[roomid].color_order[rooms[roomid].turn] + " (id: " + roomid + ")");
                }
            }
        }
        delete users[socket.id];
    });
});

server.listen(PORT);
console.log("Server listening on port " + PORT + "...");
