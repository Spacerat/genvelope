
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

Outputters = {
	png: {
		render: function(res, input_file, options, cb) {
			var fname = options.fname, width = options.width, height = options.height;
			var pngurl = "/png/"+fname+"w"+width+"h"+height+".png";
			var file = fs.createWriteStream(PUBLICDIR+pngurl);
			file.on('open', function() {
				audio.renderPNG(input_file, options, function(stream) {
					stream.pipe(file);
				});
			});
			file.on('close', function() {
				res.redirect(pngurl);
				if (cb) cb(pngurl);
			});
		},
		fail: function(res, err, cb) {
			res.redirect("/images/error.gif"); if (cb) cb();
		},
		useCache: function(res, options) {
			var sha1 = options.fname, width = options.width, height = options.height;
			var pngurl = "/png/"+sha1+"w"+width+"h"+height+".png";
			try {
				fs.statSync(PUBLICDIR+pngurl).isFile();
				res.redirect(pngurl);
				return true;
			}
			catch (e){
				return false;	
			}
		}
	},
	html: {
		fail: function(res, err, cb) {
			res.redirect("/fail"); if (cb) cb();
		},
		render: function(res, input_file, options, cb) {
			var pngid = options.fname;
			var file = fs.createWriteStream(PUBLICDIR+"/png/"+pngid+".png");
			file.on('open', function() {
				audio.renderPNG(input_file, options, function(stream) {
					stream.pipe(file);
				});
			});
			file.on('close', function() {
				res.redirect('uploaded/'+pngid);
				if (cb) cb(pngurl);
			});
		},
		useCache: function(res, options) {return false;}
	},
	tryDecode: function(res, format, input_file, wavpath, options, callback) {
		audio.decodemp3(input_file, wavpath, function(cpath) {
			if (!cpath) {
				Outputters[format].fail(res, callback);
			}
			else {
				Outputters[format].render(res, cpath, options, callback);
			}
		});
	}
}

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Genvelope'
  });
});
app.get('/uploaded/:id', function(req, res) {
	fs.stat(PUBLICDIR+'/png/'+req.params.id+".png", function(err, stat) {
		if (stat && stat.isFile()) {
			res.render('uploaded', {
				title: req.params.id + " - Genvelope",
				imgid: req.params.id
			});
		}
		else {
			res.redirect("/fail");
		}
	});
	
});
app.get('/fail', function(req, res) {
	res.render('fail', {
		title: 'Upload failed - Genvelope'
	});
});

app.post('/render/:format', function(req, res) {
	var width, height;
	var form = new formidable.IncomingForm();
	var format = req.params.format;
	form.parse(req, function(err, fields, files) {
		if (files.file == undefined) {
			Outputters[format].fail(res);
		}
		else {
			options = {
				width: parseInt(fields.width, 10) || 400,
				height: parseInt(fields.height, 10) || 200,
				fname: genUniqueFileID("public/png/", ".png")
			}
			Outputters.tryDecode(res, format, files.file.path, files.file.path+".wav", options);
		}
	});
});

app.get('/render/:format', function(req, res) {
	var path, sha1, url, wavpath, mp3path, width, height, pngurl, format, options;
	sha1 = req.param("hash");
	mp3path = TEMPDIR+"/"+sha1;
	wavpath = CACHEDIR+"/wav/"+sha1;
	width = parseInt(req.param("width"), 10) || 400;
	height =  parseInt(req.param("height"), 10) || 200;
	format = req.params.format;
	url = encodeURI(req.param("url"));
	options = {
		width: width,
		height: height,
		fname: sha1
	}
	if (Outputters[format].useCache(res, options)) return;
	var errorfunc, successfunc;
		fs.stat(wavpath, function(err) {
		if (err && err.errno === 2) {
			var dl = downloader.get(url);
			dl.addCallback(mp3path, function(err, dpath, hash, k) {
				if (!err && hash != hash) err = {message: "Incompatible hashes", code: 12345}
				if (err) {
					Outputters[format].fail(res, err);
					k(false);
				}
				else {
					Outputters.tryDecode(res, format, dpath, wavpath,options, function() {k(false);})
				}
			});
		}
		else {
			Outputters[format].render(res, wavpath, options);
		}
	});
	
});


requireDir(TEMPDIR);
requireDir(CACHEDIR);
requireDir(CACHEDIR+"/wav");
requireDir(PUBLICDIR);
requireDir(PUBLICDIR+"/png");
downloader.setTempDir(TEMPDIR);

fs.readFile("domain", "ascii", function(err, data) {
	if (!err) DOMAIN = data.replace(/^\s+|\s+$/g, '');
	app.set('view options', {
	'domain': DOMAIN
	});
	app.listen(8000);	
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

