var total_num = 4; // 参与一局游戏的总人数
var job_list  = ['wolf', 'predictor', 'villager', 'villager', 'wolf', 'villager'];

var ws_id            = 0; // 当前最大客户端连接id号
var seat_no          = 0; // 当前最大座位id号
var round            = 0; // 当前进行到第几回合
var day_night_status = 1; // 当前是白天还是黑夜， 黑夜:0 白天:1

var ws_list          = {}; // 客户端连接列表
var kill_record      = {}; // 每夜的杀人记录
var user_vote_record = {}; // 用户投票

var job_index_list  = []; // 已选职业下标列表
var user_info_list  = []; // 用户信息列表
var day_night_count = {}; // 有多少人进入了黑夜/白天

var app = require('express')();

app.get('/', function(req, res){
    res.send('<h1>Welcome Realtime Server</h1>');
});

var WebSocketServer = require('ws').Server,
wss = new WebSocketServer({ port: 3000 });


wss.on('connection', function (ws) {
    console.log('client connected:' + ws_id);
    // console.log(ws);
    ws_list[ws_id++] = ws;

    // 错误处理
    ws.on('error', function (error) {
        console.log('client error:' + error);
    });

    // 主动关闭连接
    ws.on('close', function (message) {
        console.log('client close');
        ws.close();

        for(var s in ws_list) {
            if (ws_list[s] != undefined) {
                if (ws == ws_list[s]) {
                    console.log("close:" + s);
                    delete ws_list[s];
                }
            }
        }
    });

    ws.on('message', function (message) {
        console.log(message);

        if (message == 'ping') {
            ws.send(JSON.stringify({type:'pong', content:''}));

            /*clearTimeout(clock_num); //todo

            var clock_num = setTimeout(function () {
                console.log('client timeout');
                ws.close();
            }, 30000);*/
        } else {
            var message_obj = JSON.parse(message);

            switch (message_obj.type) {
                // 进入房间
                case 'enter':
                    sendAll(JSON.stringify({type:'enter', content: userEnterRoom(message_obj.content)}));
                    if (user_info_list.length >= total_num) {
                        for (var s in ws_list) {
                            if (ws_list[s] != undefined) {
                                var ret_str = JSON.stringify({type:'begin', content: getJob(s)});
                                console.log('begin:' + s + ', data: ' + ret_str);
                                ws_list[s].send(ret_str);
                            }
                        }
                    }
                    break;
                // 进入黑夜
                case 'night':
                    changeRound(0);
                    user_vote_record = {}; // 清空上一轮的投票情况
                    break;
                // 狼人杀人
                case 'kill':
                    killAction(message_obj.content, ws);
                    break;
                // 预言家验人
                case 'check':
                    checkPerson(message_obj.content, ws);
                    break;
                // 进入白天 判断胜利条件
                case 'day':
                    changeRound(1);
                    var is_end = checkWin(0);
                    if (is_end == false) {
                        setTimeout(function () {
                            var max_vote_num = 0;
                            var target_no = 0;
                            // todo 投票相等
                            for (var s in user_vote_record) {
                                if (user_vote_record[s] != undefined && user_vote_record[s] > max_vote_num) {
                                    max_vote_num = user_vote_record[s];
                                    target_no = s;
                                }
                            }
                            console.log('target_no:' + target_no);
                            user_info_list[target_no - 1].alive = false;
                            ws.send(JSON.stringify({type:'vote', content: {target_no: target_no}}));
                        }, 20000);
                    }
                    break;
                // 投票 判断胜利条件
                case 'vote':
                    vote(message_obj.content);
                    checkWin(1);
                    break;
            };
        }
    });
});

// 群发
function sendAll(data) {
    wss.clients.forEach(function each(client) {
        console.log("broadcast:" + data);
        client.send(data);
    });
}

// 进入房间
function userEnterRoom(data) {
    // 房间已满员
    if (seat_no >= total_num) {
        return user_info_list;
    }

    for (var i = user_info_list.length - 1; i >= 0; i--) {
        if (data.user.face == user_info_list[i].face) {
            return user_info_list;
        }
    }

    // 获取座位
    data.user.seat_no = ++seat_no;
    data.user.alive = true;

    // 取得身份
    job_obj = new Object();
    while (1) {
        var index = Math.floor(Math.random() * total_num);
        var has_exist = false;

        for (var i = 0; i < job_index_list.length; i++) {
            if (job_index_list[i] == index) {
                has_exist = true;
                break;
            }
        }

        if (has_exist == false) {
            job_index_list.push(index);

            data.user.ws_id = ws_id - 1;
            data.user.job   = job_list[index];

            user_info_list.push(data.user);

            console.log(user_info_list);
            break;
        }
    }

    return user_info_list;
}

// 返回当前玩家的身份，如果是狼人同时返回同伴身份
function getJob(cur_ws_id) {
    console.log('cur_ws_id:' + cur_ws_id);

    var ret_obj = {};
    var is_wolf = false;
    for (var i = 0; i < user_info_list.length; i++) {
        if (user_info_list[i].ws_id == cur_ws_id) {
            ret_obj.job = user_info_list[i].job;
            ret_obj.seat_no = user_info_list[i].seat_no;

            if (user_info_list[i].job == 'wolf') {
                is_wolf = true;
            }
            break;
        }
    }

    if (is_wolf) {
        ret_obj.mate_no = [];
        for (var i = 0; i < user_info_list.length; i++) {
            if (user_info_list[i].job == 'wolf' && user_info_list[i].ws_id != cur_ws_id) {
                ret_obj.mate_no.push(user_info_list[i].seat_no);
                break;
            }
        }
    }

    return ret_obj;
}

// 改变白天黑夜状态
function changeRound(status) {
    console.log('day_night_count:');
    console.log(day_night_count);

    if (day_night_count[round] == undefined) {
        day_night_count[round] = 1;
    } else {
        day_night_count[round]++;
    }
    console.log('day_night_count:');
    console.log(day_night_count);
    if (day_night_count[round] >= total_num) { // 所有人都确定后才进入新的环节
        console.log('day_night_count:');
        console.log(day_night_count);
        day_night_status = status;

        console.log('status:' + status);

        if (status == 0)
        {
            sendAll(JSON.stringify({type:'night', content: ''}));
            round++; // 进入下一轮
        } else {
            sendAll(JSON.stringify({type:'day', content: ''}));
        }
    }
}

// 狼人杀人动作
function killAction(data) {
    console.log('day_night_status:' + day_night_status + ', round:' + round);
    console.log(kill_record);
    if (day_night_status == 0 && kill_record[round] == undefined) {
        kill_record[round] = {killer: data.seat_no, target_no: data.target_no};
        for (var i = 0; i < user_info_list.length; i++) {
            if (user_info_list[i].seat_no == data.target_no) {
                user_info_list[i].alive = false;
            }
        }
        console.log('kill:');
        console.log(user_info_list);
        sendAll(JSON.stringify({type:'kill', content: {target_no: data.target_no}}));
    }
}

// 预言家验人
function checkPerson(data, ws) {
    console.log('day_night_status:' + day_night_status + ', round:' + round);

    if (day_night_status == 0) {
        for (var i = 0; i < user_info_list.length; i++) {
            if (user_info_list[i].seat_no == data.seat_no) {
                if (user_info_list[i].job == 'wolf') {
                    ws.send(JSON.stringify({type:'check', content:{is_good:false}}));
                    return;
                } else {
                    ws.send(JSON.stringify({type:'check', content:{is_good:true}}));
                }
            }
        }
    }
}

// 投票
function vote(data) {
    if (user_vote_record[data.vote_no] == undefined && user_info_list[data.vote_no - 1].alive == true) {
        user_vote_record[data.vote_no] = 1;
    } else {
        user_vote_record[data.vote_no]++;
    }
}

// 判断胜利条件
function checkWin(type) {
    console.log('type:' + type);
    var can_check = false;

    if (type == 0) {
        can_check = true;
    } else if (type == 1) {
        var voute_count = 0;
        // 所有人都投了才判断胜利条件
        for (var i = 1; i <= user_info_list.length; i++) {
            if (user_vote_record[i] != undefined) {
                voute_count += user_vote_record[i];
            }
        }
        if (voute_count >= user_info_list.length) {
            can_check = true;
        }

        console.log('voute_count:' + voute_count + ', can_check:' + can_check);
    }

    var wolf_num = 0;
    var good_num = 0;
    var is_end = false;

    if (can_check == true) {
        for (var i = 0; i < user_info_list.length; i++) {
            if (user_info_list[i].alive == true) {
                if (user_info_list[i].job == 'wolf') {
                    wolf_num++;
                } else {
                    good_num++;
                }
            }
        }

        console.log(user_info_list);
        console.log('wolf_num:' + wolf_num + ', good_num:' + good_num);

        // 好人获胜
        if (wolf_num == 0) {
            sendAll(JSON.stringify({type:'end', content: {result: 1}}));
            is_end = true;
        // 狼人获胜
        } else if (total_num > 4 && wolf_num >= good_num) {
            sendAll(JSON.stringify({type:'end', content: {result: 0}}));
            is_end = true;
        // 四人及以下时改变判断条件
        } else if (total_num <= 4 && good_num == 0) {
            sendAll(JSON.stringify({type:'end', content: {result: 0}}));
            is_end = true;
        }
    }

    // 清空状态
    if (is_end == true) {
        seat_no          = 0; // 当前最大座位id号
        round            = 0; // 当前进行到第几回合
        day_night_status = 1; // 当前是白天还是黑夜， 黑夜:0 白天:1

        kill_record      = {}; // 每夜的杀人记录
        user_vote_record = {}; // 用户投票

        job_index_list  = []; // 已选职业下标列表
        user_info_list  = []; // 用户信息列表
        day_night_count = {}; // 有多少人进入了黑夜/白天
    }

    return is_end;
}
