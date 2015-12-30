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
        if (dataCount === 4)
          handleInstruction();
        break;
      
      case "transfering":
        state = "idle";
        if (data.length == 1) {
          console.log("Read: Got goodbye:", data, "\n");
        } else {
          // received length > 1 means instruction received
          dataCount += data.length - 1;
          instruction.push(data.slice(1));
          if (dataCount == 4)
            handleInstruction();
        }
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

function handleInstruction() {
  dataCount = 0;
  
  // decode instruction
  console.log(instruction);
  var operate = Buffer.concat(instruction, 4).readUInt8(3);
  var address = Buffer.concat(instruction, 4).readUInt32LE() << 3 >> 3;

  // decode operate
  operate = operate & 64;
  operate = operate == 64 ? "write" : "read";
  console.log("Operate:", operate);
  console.log("Address:", address);

  if (operate === "write") {
    sayHello();
  } else {
    // handle breakpoint
    if (address === 0x3fff) {
      console.log("\n\n================================");
      console.log("Breakpoint detected");
      console.log("================================\n\n");
      setTimeout(function() {
        state = "transfering";
        var data = new Buffer(512);
        fs.read(fd, data, 0, 512, 0, writeToSerial);
      }, 10000);
    } else {
      state = "transfering";
      var data = new Buffer(512);
      fs.read(fd, data, 0, 512, address * 512, writeToSerial);
    }
  }

  // clear instruction
  instruction = [];
}

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

