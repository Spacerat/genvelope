(function() {
  var Downloader, TEMPDIR, copyFile, crypto, downloaders, fs, get, http, parse, pathlib;
  var __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  http = require("http");
  crypto = require("crypto");
  parse = require("url").parse;
  pathlib = require("path");
  fs = require("fs");
  downloaders = {};
  TEMPDIR = "/tmp";
  copyFile = function(from, to, cb) {
    var read, write;
    read = fs.createReadStream(from);
    write = fs.createWriteStream(to);
    return write.once('open', function(fd) {
      return require('util').pump(read, write, cb);
    });
  };
  Downloader = (function() {
    Downloader.prototype.runCallbacks = function(err) {
      var callback, keep_paths, returned, _i, _len, _ref;
      keep_paths = [];
      returned = 0;
      delete downloaders[this.url];
      _ref = this.callbacks;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        callback = _ref[_i];
        callback.cb(err, this.tempname, this.filehash, __bind(function(keep) {
          var _ref2;
          returned++;
          if (keep === true && (_ref2 = callback.path, __indexOf.call(keep_paths, _ref2) < 0)) {
            keep_paths.push(callback.path);
            copyFile(this.tempname, callback.path, __bind(function(cperr) {
              if (returned === this.callbacks.length) {
                return fs.unlink(this.tempname);
              }
            }, this));
          } else if (returned === this.callbacks.length && keep_paths.length === 0) {
            fs.unlink(this.tempname);
          }
          return null;
        }, this));
      }
      return null;
    };
    Downloader.prototype.addCallback = function(path, callback) {
      if (!(this.url != null)) {
        return false;
      }
      this.callbacks.push({
        cb: callback,
        path: path,
        keep: false
      });
      return this["this"];
    };
    function Downloader(url) {
      var getter, onResponse, parsed, search;
      this.callbacks = [];
      this.filehash = "";
      this.url = url;
      if (!(url != null)) {
        return null;
      }
      downloaders[url] = this;
      parsed = parse(url);
      search = parsed.search != null ? parsed.search : "";
      this.tempname = TEMPDIR + "/" + Math.random() + pathlib.basename(parsed.pathname) + ".temp";
      onResponse = __bind(function(res) {
        var file, shasum;
        shasum = crypto.createHash('sha1');
        file = fs.createWriteStream(this.tempname, {
          flags: 'w'
        });
        res.on('data', __bind(function(chunk) {
          var encoding;
          shasum.update(chunk);
          return file.write(chunk, encoding = 'binary');
        }, this));
        return res.on('end', __bind(function() {
          this.filehash = shasum.digest('hex');
          file.end();
          return this.runCallbacks();
        }, this));
      }, this);
      getter = http.get({
        host: parsed.host,
        path: parsed.pathname + search,
        port: 80
      }, onResponse);
      getter.on('error', __bind(function(err) {
        return this.runCallbacks(err);
      }, this));
    }
    return Downloader;
  })();
  /*
  Download the file at url.
  On download, callback is run.
  
  callback = function(filename, hash, function(keep))
  */
  get = function(url) {
    if (downloaders[url] != null) {
      return downloaders[url];
    } else {
      return new Downloader(url);
    }
  };
  /*	
  	fs.stat target, (err, stats) ->
  		if err? and err.errno == 2
  			onStartDownload()
  		else if stats.isFile()
  			callback(null)
  	
  	return null
  */
  exports.get = get;
  exports.setTempDir = function(dir) {
    return TEMPDIR = dir;
  };
}).call(this);
