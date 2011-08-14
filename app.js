
/**
 * Module dependencies.
 */

var fs = require("fs");
var express = require('express');
var downloader = require('./downloader');
var audio = require('./audio');
var app = module.exports = express.createServer();
var Profile = require('./profile').Profile;
var pump = require('util').pump;
// Configuration

var TEMPDIR = "tmp";
var CACHEDIR = "cache";
var PUBLICDIR = __dirname + '/public';

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(PUBLICDIR));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Genvelope'
  });
});

var sendWavPng = function(wavname, pngurl, width, height, res) {
	var file = fs.createWriteStream(PUBLICDIR+pngurl);
	file.on('open', function() {
		audio.renderPNG(wavname, {
			width: width,
			height: height
		}, function(stream) {
			stream.pipe(file);
		});
	});
	file.on('close', function() {
		res.redirect(pngurl);
	});


}

app.get('/render/png', function(req, res) {
	var path, sha1, url, wavpath, mp3path, width, height, pngurl;
	sha1 = req.param("hash");
	mp3path = TEMPDIR+"/"+sha1;
	wavpath = CACHEDIR+"/wav/"+sha1;
	width = parseInt(req.param("width"), 10) || 400;
	height =  parseInt(req.param("height"), 10) || 200;
	pngurl = "/png/"+sha1+"w"+width+"h"+height+".png";			
	url = encodeURI(req.param("url"));		
	var usecache = false;
	try {
		usecache = fs.statSync(PUBLICDIR+pngurl).isFile();
	}
	catch (e){
	}
	
	if (usecache) {
		res.redirect(pngurl);
	}
	else {
		fs.stat(wavpath, function(err) {
			if (err && err.errno === 2) {
				var dl = downloader.get(url);
				dl.addCallback(mp3path, function(err, dpath, hash, k) {
					if (err) {
						console.log(err);
						res.redirect("/images/error.gif");
						k(false);
					}
					else if (hash != sha1) {
						console.log(hash, "!=", sha1);
						res.redirect("/images/error.gif");
						k(false);
					}
					else {
						audio.decodemp3(dpath, wavpath, function(cpath) {
							k(false);
							sendWavPng(cpath, pngurl, width, height, res);
						});
					}
				});
			}
			else {
				sendWavPng(wavpath, pngurl, width, height, res);
			}
		});
	}
});

var requireDir = function(pth, mode) {
	mode = mode || "764"
	try {
		stat = fs.statSync(pth);
	}
	catch (e) {
		fs.mkdirSync(pth, mode);
		console.log("Created directory "+pth);
	}
}
requireDir(TEMPDIR)
requireDir(CACHEDIR)
requireDir(CACHEDIR+"/wav")
requireDir(PUBLICDIR)
requireDir(PUBLICDIR+"/png")
app.listen(8000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
