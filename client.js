var SerialPort = require('serialport').SerialPort;
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');


var file;

try {
  file = fs.readFileSync(argv.f);
} catch(err) {
  console.log("Usage: node client.js -f <image file>");
  process.exit(-1);
}

//require("serialport").list(function (err, ports) {
//  ports.forEach(function(port) {
//    console.log(port.comName);
//  });
//});

var sp = new SerialPort("/dev/cu.usbserial", {
  baudrate: 115200
});

var buf = new Buffer(512);
for (var i = 0; i < 512; i++) {
  buf.writeInt8(i % 128, i);
}

function writeAndDrain(buffer, callback) {
  sp.write(buffer, function(err, result) {
    if (err) console.log(err);
    sp.drain(callback(buffer, callback));
  });
}

var i = 0;
sp.on("open", function() {
  console.log("Port has open...");
  //writeAndDrain(buf, writeAndDrain);

  setInterval(function() {
    var buffer = new Buffer(1);
    buffer.writeInt8(i);
    i = (i + 1) % 128;
    sp.write(buffer, function(err) {
      if (err) console.log(err);
    });
  }, 1000);

  sp.on('data', function(data) {
    console.log("Data received:", data.toJSON());
  });
});

