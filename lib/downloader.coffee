http = require("http")
crypto = require("crypto")
parse = require("url").parse
pathlib = require("path")
fs = require "fs"

downloaders = {}

copyFile = (from, to, cb) ->
	read = fs.createReadStream(from)
	write = fs.createWriteStream(to)
	write.once 'open', (fd)->
		require('util').pump(read, write, cb)

class Downloader
	runCallbacks: (err) ->
		keep_paths = []
		returned = 0
		delete downloaders[@url]
		for callback in @callbacks
			callback.cb err, @tempname, @filehash, (keep) =>
				returned++
				if keep == true and (callback.path not in keep_paths)
					keep_paths.push(callback.path)
					copyFile @tempname, callback.path, (cperr) =>
						if returned == @callbacks.length
							fs.unlink(@tempname)
				else if returned == @callbacks.length and keep_paths.length == 0
					fs.unlink(@tempname)
				
				
				return null
		return null
		
	addCallback: (path, callback) ->
		if not @url? then return false 
		@callbacks.push({
			cb: callback,
			path: path
			keep: false
		})
		return @this
	constructor: (url) ->
		@callbacks = []
		@filehash = ""
		@url = url
		if not url? then return null
		downloaders[url] = this
		parsed = parse(url)
		search = if parsed.search? then parsed.search else ""
		@tempname = "tmp/"+Math.random()+pathlib.basename(parsed.pathname)+".temp"
		
		onResponse = (res) =>
			shasum = crypto.createHash('sha1')
			file = fs.createWriteStream(@tempname, flags: 'w')
			res.on 'data', (chunk) =>
				shasum.update(chunk)
				file.write(chunk, encoding='binary')
			res.on 'end', =>
				@filehash = shasum.digest('hex')
				file.end()
				@runCallbacks()
		getter = http.get
			host: parsed.host
			path: parsed.pathname + search
			port: 80
			onResponse
		getter.on 'error', (err) =>
			@runCallbacks(err)
			

###
Download the file at url.
On download, callback is run.

callback = function(filename, hash, function(keep))
###
get = (url) ->
	if downloaders[url]?
		downloaders[url]
	else
		new Downloader(url)

###	
	fs.stat target, (err, stats) ->
		if err? and err.errno == 2
			onStartDownload()
		else if stats.isFile()
			callback(null)
	
	return null
###
exports.get = get



