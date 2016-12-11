// 引入 QCloud 小程序增强 SDK
var qcloud = require('../../vendor/qcloud-weapp-client-sdk/index');

// 引入配置
var config = require('../../config');

var types = ['default', 'primary', 'warn']
var pageObject = {
  data: {
    second: 20,
    choose_num : "等待开始",
    src: [],
    job_src:["", "", "", "" ,"",""],
    number: "",
    job: "",
    dead: false,
    result: {
      target_no: "",
      is_good: "",
      vote_no: ""
    }
  },

  onLoad: function() {
    this.openTunnel();
  },

  onReady: function (e) {
    // 使用 wx.createAudioContext 获取 audio 上下文 context
    this.night = wx.createAudioContext('night');
    this.wolf = wx.createAudioContext('wolf');
    this.prophet = wx.createAudioContext('prophet');
    this.day = wx.createAudioContext('day');
  },

  openTunnel() {
        // 创建信道，需要给定后台服务地址
        var tunnel = this.tunnel = new qcloud.Tunnel(config.service.tunnelUrl);
        // 监听信道内置消息，包括 connect/close/reconnecting/reconnect/error
        tunnel.on('connect', () => {
            console.log('WebSocket 信道已连接');
            this.setData({ tunnelStatus: 'connected' });
            qcloud.login({
                success(result) {
                    console.log('登录成功', result);
                    tunnel.emit('enter', {
                        user: {
                          face: result.avatarUrl,
                          name: result.nickName
                        }
                    });
                },

                fail(error) {
                    console.log('登录失败', error);
                }
            });
            
        });

        tunnel.on('enter', packet => {
            var src = [];
            packet.forEach(function(item, index) {
              src.push(item.face);
            });
            this.setData({src});
        });

        tunnel.on('begin', packet => {
            var src = [];
            var number = packet.seat_no;
            var job = packet.job;
            var job_src = this.data.job_src;
            this.setData({number});
            this.setData({job});
            this.night.play();
            tunnel.emit('night', {});
            if (job == "wolf") {
                job_src[number - 1] = "http://brandonwei-10027562.cos.myqcloud.com/wolf.png";
                packet.mate_no.forEach(function(item) {
                   job_src[item - 1] = "http://brandonwei-10027562.cos.myqcloud.com/wolf.png";
                });
                this.setData({choose_num : "您是狼人", job_src: job_src});
            }
            else if (job == "villager") {
              job_src[number - 1] = "http://brandonwei-10027562.cos.myqcloud.com/people.png";
              this.setData({choose_num : "您是村民", job_src: job_src});
            }
            else {
              job_src[number - 1] = "http://brandonwei-10027562.cos.myqcloud.com/prophet.png";
              this.setData({choose_num : "您是预言家", job_src: job_src});
            }
            var that = this;
            setTimeout(function() {
              that.wolf.play();
              that.state = "wolf";
              countdown(that);
              if (job == "wolf") {
                that.setData({choose_num : "请杀人"});
              }
              else if (job == "villager") {
                that.setData({choose_num : "天黑请闭眼"});
              }
              else {
                that.setData({choose_num : "天黑请闭眼"});
              }
            }, 5000)
        });

        tunnel.on('kill', packet => {
            this.data.result.target_no = packet.target_no;
            console.log("kill");
        });

        tunnel.on('check', packet => {
            this.data.result.is_good = packet.is_good;
            if (this.data.result.is_good == true) {
              this.setData({choose_num: "验的是好人"});
            }
            else {
              this.setData({choose_num: "验的是狼人"});
            }
            console.log("check");
        });

        tunnel.on('vote', packet => {
            this.data.result.vote_no = packet.target_no;
            var src = this.data.src;
            src[this.data.result.vote_no - 1] = "http://brandonwei-10027562.cos.myqcloud.com/dead.png";
            this.setData({src});
            if (this.data.result.vote_no == this.data.number) {
              this.setData({dead: true});
            }
            var that = this;
            setTimeout(function() {
              if (that.end) {
                return;
              }
              tunnel.emit('night', {});
              that.night.play();
              that.setData({result : {
                  target_no: "",
                  is_good: "",
                  vote_no: ""
                },
                second: 20
              });
              that.state = "wolf";
              countdown(that);
              if (that.data.job == "wolf") {
                that.setData({choose_num : "请杀人"});
              }
              else if (that.data.job == "villager") {
                that.setData({choose_num : "天黑请闭眼"});
              }
              else {
                that.setData({choose_num : "天黑请闭眼"});
              }
            }, 5000)
            console.log("vote");
        });

        tunnel.on('night', packet => {
          this.state = "wolf";
          this.setData({second: 20});
          console.log("night");
        });

        tunnel.on('day', packet => {
          this.state = "people";
          this.setData({second: 20});
          var src = this.data.src;
          var choose_num = "请投票";
          src[this.data.result.target_no - 1] = "http://brandonwei-10027562.cos.myqcloud.com/dead.png";
          this.setData({src});
          this.setData({choose_num});
          if (this.data.result.target_no == this.data.number) {
            this.setData({dead: true});
          }
          countdown(this);
          console.log("day");
        });

        tunnel.on('end', packet => {
            this.end = "end";
            if (packet.result == 0) {
              this.setData({choose_num: "狼人获胜"});
            }
            else {
              this.setData({choose_num: "好人获胜"});
            }
            console.log("end");
        });

        tunnel.on('close', () => {
            console.log('WebSocket 信道已断开');
            this.setData({ tunnelStatus: 'closed' });
        });

        tunnel.on('reconnecting', () => {
            console.log('WebSocket 信道正在重连...')
        });

        tunnel.on('reconnect', () => {
            console.log('WebSocket 信道重连成功')
        });

        tunnel.on('error', error => {
            console.error('信道发生错误：', error);
        });

        // 监听自定义消息（服务器进行推送）
        tunnel.on('speak', speak => {
            console.log('收到说话消息：', speak);
        });
        
        // 打开信道
        tunnel.open();

        this.setData({ tunnelStatus: 'connecting' });
    },
  
  choose_1: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 1
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 1
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 1
      });
      this.tunnel.emit('check', {
          seat_no: 1,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 1
      });
      this.tunnel.emit('vote', {
          vote_no: 1,
      });
    }
  },
  choose_2: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 2
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 2
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 2
      });
      this.tunnel.emit('check', {
          seat_no: 2,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 2
      });
      this.tunnel.emit('vote', {
          vote_no: 2,
      });
    }
  },
  choose_3: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 3
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 3
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 3
      });
      this.tunnel.emit('check', {
          seat_no: 3,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 3
      });
      this.tunnel.emit('vote', {
          vote_no: 3,
      });
    }
  },
  choose_4: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 4
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 4
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 4
      });
      this.tunnel.emit('check', {
          seat_no: 4,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 4
      });
      this.tunnel.emit('vote', {
          vote_no: 4,
      });
    }
  },
  choose_5: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 5
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 5
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 5
      });
      this.tunnel.emit('check', {
          seat_no: 5,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 5
      });
      this.tunnel.emit('vote', {
          vote_no: 5,
      });
    }
  },
  choose_6: function(e){
    if (this.data.dead == true) {
      return;
    }
    if (this.state == "wolf" && this.data.job == "wolf" && typeof this.data.choose_num != "number" && !this.data.result.target_no) {
      this.setData({
        choose_num : 6
      });
      this.tunnel.emit('kill', {
          seat_no: this.data.number,
          target_no: 6
      });
    }
    if (this.state == "prophet" && this.data.job == "predictor" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 6
      });
      this.tunnel.emit('check', {
          seat_no: 6,
      });
    }
    if (this.state == "people" && typeof this.data.choose_num != "number") {
      this.setData({
        choose_num : 6
      });
      this.tunnel.emit('vote', {
          vote_no: 6,
      });
    }
  },
};
Page(pageObject);
function countdown(that) {
   var second = that.data.second
   if (second == 0) {
    if (that.state == "wolf") {
      that.state = "prophet"
      that.prophet.play();
      that.setData({
       second: 20
      });
      if (that.data.job == "predictor") {
        that.setData({choose_num : "请验人"});
      }
      countdown(that);
    }
    else if (that.state == "prophet") {
      that.state = "people"
      that.day.play();
      that.setData({
       second: 20
      });
      that.tunnel.emit('day', {});
    }
    return ;
   }
   var time = setTimeout(function(){
    that.setData({
     second: second - 1,
     choose_num: that.data.choose_num,
    });
    countdown(that);
   },1000)
  }