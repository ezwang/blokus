// TODO: implement timer
// TODO: better auto skip if can't move
var socket = null;
var player_color = null;
var room_id = null;
var selected = null;
var is_turn = false; 
var pieces = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 2], [1, 3], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
    [[0, 0], [0, 1], [1, 0], [2, 1], [2, 0]],
    [[0, 2], [1, 1], [0, 1], [2, 1], [1, 0]],
    [[1, 2], [1, 1], [0, 1], [2, 1], [1, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 2]],
];


var touching = [[0, 1], [0, -1], [-1, 0], [1, 0]];
var diagonal = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

function start_game(color) {
    $("#menu").hide();
    if (color) {
        player_color = color;
    }
    is_turn = false;
    set_player_color(player_color);
    $("#board td").removeClass("red green blue yellow");
    $("td#b0-0, td#b0-19, td#b19-19, td#b19-0").addClass("corner");
    $("#pieces").children().remove();
    $.each(pieces, function(k, v) {
        var piece = $("<div class='piece " + player_color + "' data-id='" + k + "' />").appendTo("#pieces");
        drawPiece(piece, v);
        piece.draggable({ revert: true,
            start: function(ev, ui) {
                selected = $(this);
        }, stop: function() {
            selected = null;
        } });
    });
    $("#skip-container").hide();
    $("#game, #info").fadeIn();
    $("#chat-output").children().remove();
    chat("<div><b>Game Started!</b> You can type in the box below and press enter to chat.</div>");
    chat("<div>You can use the command /msg &lt;color&gt; &lt;player&gt; to privately message a player.</div>");
}

function update_score() {
    $.each(["red", "green", "blue", "yellow"], function(k, v) {
        $(".player." + v + " .score").text($("#board td." + v).length);
    });
    var s = $("#info table tr").sort(function(a, b) {
        var tda = parseInt($(a).find("td:eq(1)").text());
        var tdb = parseInt($(b).find("td:eq(1)").text());
        return tda < tdb ? 1 : tda > tdb ? -1 : 0;
    });
    $("#info table tr").remove();
    $.each(s, function(k, v) {
        $("#info table").append(v);
    });
}

function drawPiece(piece, arr) {
    var wmax = 0;
    var vmax = 0;
    piece.children().remove();
    $.each(arr, function(k2, v2) {
        var block = $("<div class='block' />");
        block.css({
            top: v2[0]*34 + "px",
            left: v2[1]*34 + "px"
        });
        var c = Math.abs(v2[0] + 1)*34;
        var d = Math.abs(v2[1] + 1)*34;
        if (c > wmax) {
            wmax = c;
        }
        if (d > vmax) {
            vmax = d;
        }
        piece.append(block);
    });
    var tmax = Math.max(vmax, wmax);
    piece.css({
        "width": vmax + "px",
        "height": wmax + "px"
    });
}

function set_player_color(color) {
    player_color = color;
    $(".piece").each(function(k, v) {
        $(this).removeClass("red green blue yellow").addClass(color);
    });
}

$(document).ready(function() {
    for (var i = 0; i < 20; i++) {
        var tr = $("<tr />").appendTo("#board");
        for (var j = 0; j < 20; j++) {
            tr.append("<td id='b" +  i + "-" + j + "'></td>");
        }
    }
    $(window).keydown(function(e) {
        if (selected) {
            if (e.keyCode == 38 || e.keyCode == 40) {
                e.preventDefault();
                return false;
            }
        }
    });
    $(window).keyup(function(e) {
        if (selected) {
            if (e.keyCode == 82 || e.keyCode == 39) {
                // rotate piece (right)
                var id = selected.attr("data-id");
                for (var i = 0; i < pieces[id].length; i++) {
                    var c = pieces[id][i];
                    pieces[id][i] = [c[1], (selected.height()/34-1)-c[0]];
                }
                drawPiece(selected, pieces[id]);
                e.preventDefault();
            }
            if (e.keyCode == 37) {
                // rotate piece (left)
                var id = selected.attr("data-id");
                for (var i = 0; i < pieces[id].length; i++) {
                    // TODO: fix this hack
                    for (var j = 0; j < 3; j++) {
                        var c = pieces[id][i];
                        pieces[id][i] = [c[1], (selected.height()/34-1)-c[0]];
                    }
                }
                drawPiece(selected, pieces[id]);
                e.preventDefault();
            }
            if (e.keyCode == 70) {
                // flip piece
                var id = selected.attr("data-id");
                for (var i = 0; i < pieces[id].length; i++) {
                    var c = pieces[id][i];
                    pieces[id][i] = [c[0], (selected.width()/34-1)-c[1]];
                }
                drawPiece(selected, pieces[id]);
                e.preventDefault();
            }
            if (e.keyCode == 38 || e.keyCode == 40) {
                // flip piece (up/down)
                var id = selected.attr("data-id");
                for (var i = 0; i < pieces[id].length; i++) {
                    var c = pieces[id][i];
                    pieces[id][i] = [(selected.height()/34-1)-c[0], c[1]];
                }
                drawPiece(selected, pieces[id]);
            }
        }
    });
    // accepts global coordinates in array
    function check_valid_placement(piece) {
        var flag = false;
        // make sure piece is not touching piece of same color
        $.each(piece, function(k, v) {
            $.each(touching, function(k2, v2) {
                var pos = [v[0] + v2[0], v[1] + v2[1]];
                if (pos[0] < 0 || pos[0] >= 20 || pos[1] < 0 || pos[1] >= 20) {
                    return;
                }
                if (contains(pos, piece))
                    return;
                var b = $("td#b" + (pos[0]) + "-" + (pos[1]));
                if (b.hasClass(player_color)) {
                    flag = true;
                    return false;
                }
            });
            if (flag) {
                return false;
            }
        });
        if (flag) {
            return false;
        }
        // make sure piece is connected diagonally
        $.each(piece, function(k, v) {
            $.each(diagonal, function(k2, v2) {
                var pos = [v[0] + v2[0], v[1] + v2[1]];
                if (pos[0] < 0 || pos[0] >= 20 || pos[1] < 0 || pos[1] >= 20) {
                    return;
                }
                if (contains(pos, piece))
                    return;
                var b = $("td#b" + (pos[0]) + "-" + (pos[1]));
                if (b.hasClass(player_color)) {
                    flag = true;
                    return false;
                }
            });
            if ((v[0] == 0 || v[0] == 19) && (v[1] == 0 || v[1] == 19)) {
                flag = true;
                return false;
            }
        });
        if (!flag)
            return false;
        return true;
    }
    $("#board").droppable({ drop: function(evt, ui) {
        var e = ui.draggable;
        // process piece drop here
        if (!e.hasClass("piece")) {
            return;
        }
        if (!socket || !socket.connected) {
            return;
        }
        var c = e.offset();
        var d = $("#board").offset();
        var f = { top: Math.round((c.top - d.top) / 34), left: Math.round((c.left - d.left) / 34) };
        if (f.top > 20 || f.top < 0 || f.left > 20 || f.left < 0) {
            return;
        }
        var pieceid = e.attr("data-id");
        var flag = false;
        var global = [];
        $.each(pieces[pieceid], function(k, v) {
            var b = $("td#b" + (f.top + v[0]) + "-" + (f.left + v[1]));
            global.push([(f.top + v[0]), (f.left + v[1])]);
            if (!b.length) {
                flag = true;
                return false;
            }
            if (b.is(".red, .green, .blue, .yellow")) {
                flag = true;
                return false;
            }
        });
        if (flag)
            return;
        if (!is_turn)
            return;
        if (!check_valid_placement(global)) {
            return;
        }
        $.each(pieces[pieceid], function(k, v) {
            $("td#b" + (f.top + v[0]) + "-" + (f.left + v[1])).addClass(player_color);
        });
        update_score();
        e.remove();
        socket.emit("turn", { pieces: global });
        is_turn = false;
        $("#board").removeClass("your-turn");
        $("#title").text("Blokus");
        $("#skip-container").hide();
    } });
    $("#skip").click(function(e) {
        e.preventDefault();
        socket.emit("turn", { pieces: [] });
        is_turn = false;
        $("#board").removeClass("your-turn");
        $("#title").text("Blokus");
        $("#skip-container").hide();
        chat("<div style='color:grey'>turn skipped</div>");
    });
    function enable_turn() {
        is_turn = true;
        $("#title").text("Your Turn!");
        $("#board").addClass("your-turn");
        $("#skip-container").show();
    }
    var searching = false;
    $("#username").keypress(function(e) {
        if (e.which == 13) {
            $("#start").click();
        }
    });
    $("#start").click(function(e) {
        $("#username").removeClass("error");
        if (!$("#username").val()) {
            $("#username").addClass("error").focus();
            return;
        }
        e.preventDefault();
        if (searching) {
            $(this).removeClass("leave").text("Start");
            $("#username").attr("disabled", false);
            $("#loading").slideUp();
            socket.disconnect();
        }
        else {
            if (localStorage) {
                localStorage.setItem("username", $("#username").val());
            }
            $(this).addClass("leave");
            $(this).text("Cancel");
            $("#username").attr("disabled", true);
            $("#loading").slideDown("fast");
            $("#player-blocks span").removeClass("filled");
            socket = io.connect();
            socket.on("connect", function() {
                $("#chat-output").children().remove();
                $("#chat").fadeIn();
                chat("<div><b>Looking for a game...</b> While you wait, you can use this window to chat with other people.</div>");
                socket.emit("username", { username: $("#username").val() });
            });
            socket.on("disconnect", function() {
                chat("<div style='color:grey'>disconnected</div>");
                // if still in lobby, hide chat
                if (!room_id) {
                    $("#chat").fadeOut();
                }
            });
            socket.on("find", function(data) {
                $("#player-blocks span").removeClass("filled");
                $("#player-blocks span").slice(0, data.players).addClass("filled");
            });
            socket.on("start", function(data) {
                player_color = data.color;
                $.each(data.players, function(k, v) {
                    $("#info .player." + k + " .name").text(v);
                });
                room_id = data.id;
                start_game();
                $("#info .player").removeClass("current");
                $("#info .player." + data.turn).addClass("current")
                $("#info .player .name i").remove();
                $("#info .player." + data.turn + " .name").prepend("<i class='fa fa-star'></i> ");
            });
            socket.on("end", function(data) {
                is_turn = false;
                $("#title").text("Game Over");
                $("#info .player").removeClass("current");
                $("#info .player .name i").remove();
                chat("<div><b>Game Over!</b> You have been automatically disconnected from the server.</div>");
                chat("<div><a href='#' onclick='location.reload(true); return false;'>Play again?</a></div>");
                socket.disconnect();
            });
            socket.on("chat", function(data) {
                if (data.username) {
                    chat("<div><b style='color:" + data.color + "'>" + data.username + ":</b> " + $("<div />").text(data.text).html() + "</div>");
                }
                else {
                    chat("<div style='color:" + data.color + "'>" + $("<div />").text(data.text).html() + "</div>");
                }
            });
            socket.on("turn", function(data) {
                if (data.pieces && data.color != player_color) {
                    $.each(data.pieces, function(k, v) {
                        $("td#b" + v[0] + "-" + v[1]).addClass(data.color);
                    });
                }
                if (data.turn == player_color) {
                    if ($("#pieces .piece").length == 0) {
                        $("#skip").click();
                    }
                    else if (!check_spaces()) {
                        $("#skip").click();
                    }
                    else {
                        enable_turn();
                    }
                }
                else {
                    $("#board").removeClass("your-turn");
                    $("#title").text("Blokus");
                    is_turn = false;
                }
                $("#info .player").removeClass("current");
                $("#info .player." + data.turn).addClass("current");
                $("#info .player .name i").remove();
                $("#info .player." + data.turn + " .name").prepend("<i class='fa fa-star'></i> ");
                update_score();
            });
        }
        searching = !searching;
    });
    $("#chat-input").keypress(function(e) {
        if (e.which == 13 && $("#chat-input").val() && socket.connected) {
            socket.emit("chat", { text: $("#chat-input").val() });
            $("#chat-input").val("");
        }
    });
    if (localStorage) {
        $("#username").val(localStorage.getItem("username") || "");
    }
});
function remove_touching(unoc) {
    var nunoc = [];
    for (var i = 0; i < unoc.length; i++) {
        var np = [];
        $.each(unoc[i], function(k, v) {
            var flag = false;
            $.each(touching, function(k2, v2) {
                var pos = [v[0] + v2[0], v[1] + v2[1]];
                if (pos[0] < 0 || pos[0] >= 20 || pos[1] < 0 || pos[1] >= 20) {
                    return;
                }
                if (contains(pos, unoc[i]))
                    return;
                var b = $("td#b" + (pos[0]) + "-" + (pos[1]));
                if (b.hasClass(player_color)) {
                    flag = true;
                    return false;
                }
            });
            if (!flag) {
                np.push(v);
            }
        });
        if (np.length > 0) {
            nunoc.push(np);
        }
    }
    return nunoc;
}
function check_corners(unoc) {
    var nunoc = [];
    for (var i = 0; i < unoc.length; i++) {
        var flag = false;
        $.each(unoc[i], function(k, v) {
            $.each(diagonal, function(k2, v2) {
                var pos = [v[0] + v2[0], v[1] + v2[1]];
                if (pos[0] < 0 || pos[0] >= 20 || pos[1] < 0 || pos[1] >= 20) {
                    return;
                }
                var b = $("td#b" + (pos[0]) + "-" + (pos[1]));
                if (b.hasClass(player_color)) {
                    flag = true;
                    return false;
                }
                if ((v[0] == 0 || v[0] == 19) && (v[1] == 0 || v[1] == 19)) {
                    flag = true;
                    return false;
                }
            });
            if (flag) {
                nunoc.push(unoc[i]);
            }
        });
    }
    return nunoc;
}
function check_spaces() {
    var maxlen = 0;
    var unoc = check_corners(remove_touching(check_board()));
    for (var i = 0; i < unoc.length; i++) {
        var len = unoc[i].length;
        if (len > maxlen) {
            maxlen = len;
        }
    }
    if (maxlen == 0) {
        return false;
    }
    var minpiece = 400;
    $("#pieces .piece").each(function(k, v) {
        var id = $(v).attr("data-id");
        if (minpiece > pieces[id].length) {
            minpiece = pieces[id].length;
        }
    });
    return minpiece <= maxlen;
}
function check_board() {
    var flags = new Array(400);
    var unoc = [];
    for (var i = 0; i < 400; i++) {
        flags[i] = 0;
    }
    for (var i = 0; i < 20; i++) {
        for (var j = 0; j < 20; j++) {
            if (flags[i*20+j]) {
                continue;
            }
            var occupied = $("td#b" + i + "-" + j).is(".red, .green, .blue, .yellow");
            if (occupied)
                continue;
            var chunk = [];
            var queue = [[i, j]];
            while (queue.length > 0) {
                var item = queue.pop();
                if (item[0] < 0 || item[1] < 0 || item[0] > 19 || item[1] > 19)
                    continue;
                if (flags[item[0]*20+item[1]])
                    continue;
                flags[item[0]*20+item[1]] = 1;
                var o = $("td#b" + item[0] + "-" + item[1]).is(".red, .green, .blue, .yellow");
                if (!o) {
                    chunk.push(item);
                    queue.push([item[0]-1, item[1]]);
                    queue.push([item[0]+1, item[1]]);
                    queue.push([item[0], item[1]-1]);
                    queue.push([item[0], item[1]+1]);
                }
            }
            if (chunk.length > 0) {
                unoc.push(chunk);
            }
        }
    }
    return unoc;
}
function contains(needle, haystack) {
    var flag = false;
    $.each(haystack, function(k, v) {
        if (v[0] == needle[0] && v[1] == needle[1]) {
            flag = true;
            return false;
        }
    });
    return flag;
}
function chat(msg) {
    $("#chat-output").append(msg);
    $("#chat-output").scrollTop($("#chat-output")[0].scrollHeight);
}
