(function() {
  var Canvas, copyFile, decodemp3, decoders, fs, renderPNG, spawn;
  spawn = require('child_process').spawn;
  fs = require("fs");
  Canvas = require('canvas');
  copyFile = function(from, to, cb) {
    var read, write;
    if (from === to) {
      cb();
    }
    read = fs.createReadStream(from);
    write = fs.createWriteStream(to);
    return write.once('open', function(fd) {
      return require('util').pump(read, write, cb);
    });
  };
  decoders = {};
  decodemp3 = function(inputname, outputname, callback) {
    var decoder, onFinish, proc;
    decoder = decoders[inputname];
    onFinish = function(fname) {
      if (!fname) {
        callback(null, {
          message: "Failed to decode file (1)."
        });
        fs.rename(outputname, outputname + "_fail");
      } else {
        fs.stat(fname, function(err, stat) {
          if (err) {
            return callback(null, err);
          } else {
            if (stat.size < 50) {
              callback(null, {
                message: "Failed to decode file (0)."
              });
              return fs.rename(outputname, outputname + "_fail");
            } else {
              return callback(fname);
            }
          }
        });
      }
      if (decoders[inputname] != null) {
        return delete decoders[inputname];
      }
    };
    if (decoder != null) {
      return decoder.proc.once('exit', function(code, signal) {
        if (code === 0 && decoder.output === outputname) {
          return onFinish(outputname);
        } else if (code === 0) {
          return copyFile(decoder.output, outputname, function() {
            return onFinish(outputname);
          });
        } else {
          return callback(null);
        }
      });
    } else {
      proc = spawn('mpg123', ['-2m', '--8bit', '--wav', outputname, inputname]);
      decoder = decoders[inputname] = {
        proc: proc,
        output: outputname
      };
      return proc.once('exit', function(code, signal) {
        if (code === 0) {
          return onFinish(outputname);
        } else {
          return onFinish(false);
        }
      });
    }
  };
  renderPNG = function(filename, options, callback) {
    var canvas, clock, ctx, data_max, data_min, data_rms, height, i, max, mid, min, multi, onData, renderEnvelopes, size, sqsum, step, width;
    canvas = ctx = null;
    i = step = size = 0;
    max = min = sqsum = 0;
    if (options == null) {
      options = {};
    }
    width = (options.width != null) && options.width > 0 ? options.width : 400;
    height = (options.height != null) && options.height > 0 ? options.height : 200;
    data_max = [];
    data_min = [];
    data_rms = [];
    multi = height / 256;
    mid = height / 2;
    clock = null;
    onData = function(n) {
      if (i > 43) {
        if ((i % step) === 0) {
          data_max.push(max * multi + mid);
          data_min.push(min * multi + mid);
          data_rms.push(Math.sqrt(sqsum / step) * multi);
          max = min = sqsum = 0;
        }
        if (n > max) {
          max = n;
        }
        if (n < min) {
          min = n;
        }
        sqsum += n * n;
      }
      return i++;
    };
    fs.stat(filename, function(err, stats) {
      var stream;
      if (err || !stats || !stats.isFile()) {
        console.error(err, stats);
      } else {
        canvas = new Canvas(width, height);
        ctx = canvas.getContext('2d');
        size = stats.size;
        step = Math.ceil(size / width);
        stream = fs.createReadStream(filename);
        stream.on('data', function(data) {
          var d, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = data.length; _i < _len; _i++) {
            d = data[_i];
            _results.push(onData(d - 128));
          }
          return _results;
        });
        stream.on('end', renderEnvelopes);
      }
      return null;
    });
    renderEnvelopes = function() {
      var count, stream, x;
      count = data_rms.length - 1;
      ctx.moveTo(0, mid);
      ctx.beginPath();
      x = 0;
      while (x <= count) {
        ctx.lineTo(x, data_max[x]);
        x++;
      }
      x = count;
      while (x >= 0) {
        ctx.lineTo(x, data_min[x]);
        x--;
      }
      x = 0;
      ctx.closePath();
      ctx.fillStyle = 'rgb(250,210,210)';
      ctx.fill();
      ctx.beginPath();
      x = 0;
      while (x <= count) {
        ctx.lineTo(x, data_rms[x] + mid);
        x++;
      }
      x = count;
      while (x >= 0) {
        ctx.lineTo(x, mid - data_rms[x]);
        x--;
      }
      ctx.closePath();
      ctx.fillStyle = 'rgb(150,30,30)';
      ctx.fill();
      stream = canvas.createPNGStream();
      if (callback != null) {
        callback(stream);
      }
      return null;
    };
    return null;
  };
  exports.decodemp3 = decodemp3;
  exports.renderPNG = renderPNG;
}).call(this);
