var qcloud = require('../../vendor/qcloud-weapp-client-sdk/index');

var types = ['default', 'primary', 'warn'];
var pageObject = {
  data: {
    defaultSize: 'default',
    primarySize: 'default',
    warnSize: '50%',
    disabled: false,
    plain: false,
    loading: false,
    src: "../img/background.png",
    text: "月圆之夜"
  },
  createRoom: function(e) {
    this.setData({
      disabled: !this.data.disabled
    })
  },
  joinRoom: function(e) {
    wx.navigateTo({ url: '../room/room' })
  },
}
Page(pageObject)