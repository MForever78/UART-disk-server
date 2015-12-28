var SerialPort = require('serialport').SerialPort;
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var path = require('path');

var fd;

if (!argv.f) {
  console.log("Usage: node server.js -f <image file>");
  process.exit(-1);
} else {
  try {
    fd = fs.openSync(path.join(__dirname, argv.f), 'r+');
  } catch(err) {
    console.log("Usage: node server.js -f <image file>");
    process.exit(-1);
  }
}

var sp = new SerialPort("/dev/cu.usbserial", {
  baudrate: 115200
});

var buf = new Buffer(512);
var state = "idle";
var dataCount = 0;
var instruction = [];
var received = [];

sp.on("open", function() {
  console.log("Port has open...");

  sp.on('data', function(data) {
    console.log("Data received:", data.toJSON());
    switch(state) {
      case "idle":
        dataCount += data.length;
        instruction.push(data);
        if (dataCount === 4) {
          dataCount = 0;
          state = "transfering";
          
          // decode instruction
          console.log(instruction);
          var operate = Buffer.concat(instruction, 4).readUInt8(3);
          var address = Buffer.concat(instruction, 4).readUInt32LE() << 2 >> 2;

          // decode operate
          operate = operate == 128 ? "write" : "read";
          console.log("Operate:", operate);
          console.log("Address:", address);

          if (operate === "write") {
            sayHello();
          } else {
            var data = new Buffer(512);
            fs.read(fd, data, address, 512, 0, writeToSerial);
          }

          // clear instruction
          instruction = [];
        }
        break;
      
      case "transfering":
        state = "idle";
        console.log("Read: Got goodbye:", data, "\n");
        break;

      case "receiving":
        received.push(data);
        dataCount += data.length;

        if (dataCount === 513) {
          dataCount = 0;
          console.log("Write: Data receive complete");
          console.log("Write: Received goodbye");

          var data = Buffer.concat(received, 512);
          fs.write(fd, data, 0, 512, address * 512, function(err) {
            if (err) throw err;
            console.log("Write: Write to disk complete\n");
            state = "idle";
          });

          received = [];
        }
        break;
    }
  });
});

function writeToSerial(err, length, data) {
  if (err) throw err;
  var hello = new Buffer(1);
  hello[0] = 0xff;
  sp.write(hello, function(err, result) {
    if (err) throw err;
    console.log("Read: Say hello");

    sp.write(data, function(err, result) {
      if (err) throw err;
      console.log("Read: Sent", result, "byte data");
    });
  });
}

function sayHello() {
  var hello = new Buffer(1);
  hello[0] = 0xff;
  sp.write(hello, function(err, result) {
    if (err) throw err;
    state = "receiving";
    console.log("Write: Say hello");
  })
}

process.on('SIGINT', function() {
  console.log("\nRest in peace, bro!");
  fs.closeSync(fd);
  process.exit(0);
});

