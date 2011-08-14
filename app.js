
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

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
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
    title: 'Express'
  });
});

var sendWavPng = function(wavname, pngurl, width, height, res) {
	var file = fs.createWriteStream("public"+pngurl);
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
	mp3path = "tmp/"+sha1;
	wavpath = "cache/wav/"+sha1;
	width = parseInt(req.param("width"), 10) || 400;
	height =  parseInt(req.param("height"), 10) || 200;
	pngurl = "/png/"+sha1+"w"+width+"h"+height+".png";			
	url = req.param("url");		
	
	var usecache = false;
	try {
		usecache = fs.statSync("public"+pngurl).isFile();
	}
	catch (e){
	}
	
	if (usecache) {
		res.redirect(pngurl);
	}
	else {
		fs.stat(wavpath, function(err) {
			if (err && err.errno === 2) {
				downloader.get(url, mp3path, function(err, dpath, hash, k) {
					if (err || hash !== sha1) {
						res.redirect("/images/error.gif");
						res.end();
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


app.listen(8000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
