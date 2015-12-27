var fs = require("fs");
var path = require("path");
var data = new Buffer(512);

for (var i = 0; i < 512; i++) {
  data[i] = i % 256;
}

var fd = fs.openSync(path.join(__dirname, "../image/SimpleOS.vhd"), "w");
fs.writeSync(fd, data, 0, 512);
fs.closeSync(fd);

