
/**
 * Module dependencies.
 */

var fs = require("fs");
var express = require('express');
var downloader = require('./downloader');
var audio = require('./audio');
var Profile = require('./profile').Profile;
var pump = require('util').pump;
var formidable = require('formidable');
var app = module.exports = express.createServer();
// Configuration

var TEMPDIR = "/tmp/genvelope";
var CACHEDIR = "cache";
var PUBLICDIR = __dirname + '/public';
var DOMAIN = "http://srv.meteornet.net:8000"

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


//Shite

/* Generate a random 10 character unique filename.

	In the path and with the given extension, the file will be unique.
	Returns only the random 10 characters
*/
var genUniqueFileID = function(path, ext) {
	var h = require('crypto').createHash('sha1');
	var gid = function() {
		h.update(Math.random().toString());
		str = h.digest('hex').slice(0, 10);
		try {
			fs.statSync(path+str+ext);
			return gid(path, ext);
		 }
		catch (e) {
			return str;
		}
	}
	return gid();
}

/* Render the wave file located at wavname as a PNG.

	PNG file will have the given width/height
	File is saved in PUBLICDIR+pngurl
	On completion, cb is called with pngurl
	as the only argument.
*/
var sendWavPng = function(wavname, pngurl, options, cb) {
	var file = fs.createWriteStream(PUBLICDIR+pngurl);
	file.on('open', function() {
		audio.renderPNG(wavname, options, function(stream) {
			stream.pipe(file);
		});
	});
	file.on('close', function() {
		cb(pngurl);
	});


}

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

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Genvelope'
  });
});
app.get('/uploaded/:id', function(req, res) {
	res.render('uploaded', {
		title: req.params.id + " - Genvelope",
		imgid: req.params.id
	});
});
app.get('/fail', function(req, res) {
	res.render('fail', {
		title: 'Upload failed - Genvelope'
	});
});


app.post('/render/png', function(req, res) {
	var width, height;
	
	
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		width = parseInt(fields.width, 10) || 400;
		height = parseInt(fields.height, 10) || 200;
		if (files.file == undefined) {
			res.redirect("/fail");
		}
	});
	form.on('file', function(name, file) {
		audio.decodemp3(file.path, file.path+".wav", function(cpath) {
			console.log(cpath);
			if (!cpath) {
				res.redirect("/fail");
				return;
			}
			var pngurl = genUniqueFileID("public/png/", ".png");
			sendWavPng(cpath, "/png/"+pngurl+".png", {width: width, height:height}, function() {
				res.redirect("/uploaded/"+pngurl)
			});
			
		});
	});
	/*
	res.pipe(tempfile);
	tempfile.on('close', function() {
		audio.decodemp3(tempfile, wavpath, function(cpath) {
			var pngurl = genUniqueFile("public/png", ".png");
			sendWavPng(cpath, pngurl.slice(6), width, height, res);
		});
	});
	*/
});

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
							sendWavPng(cpath, pngurl, width, height, res.redirect);
						});
					}
				});
			}
			else {
				sendWavPng(wavpath, pngurl, {width: width, height:height}, function() {
					res.redirect(pngurl);
				});
			}
		});
	}
});


requireDir(TEMPDIR);
requireDir(CACHEDIR);
requireDir(CACHEDIR+"/wav");
requireDir(PUBLICDIR);
requireDir(PUBLICDIR+"/png");
fs.readFile("domain", "ascii", function(err, data) {
	if (!err) DOMAIN = data.replace(/^\s+|\s+$/g, '');
	app.set('view options', {
	'domain': DOMAIN
	});
	app.listen(8000);	
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

