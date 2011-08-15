spawn = require('child_process').spawn
fs = require "fs"
Canvas = require('canvas')
Profile = require('./profile').Profile

copyFile = (from, to, cb) ->
	if from == to then cb()
	read = fs.createReadStream(from)
	write = fs.createWriteStream(to)
	write.once 'open', (fd)->
		require('util').pump(read, write, cb)

decoders = {}

decodemp3 = (inputname, outputname, callback) ->
	decoder = decoders[inputname]
	onFinish = (fname) ->
		callback(null) if not fname? 
		fs.stat fname, (err, stat) ->
			if (err)
				callback(null)
			else
				if stat.size < 50
					callback(null)
				else
					callback(fname)
			delete decoders[inputname] if decoders[inputname]?

	if decoder?
		decoder.proc.once 'exit', (code, signal) ->
			if code == 0 and decoder.output == outputname
				onFinish(outputname)
			else if code == 0
				copyFile decoder.output, outputname, -> onFinish(outputname)
			else
				callback(null)
	else
		proc = spawn('mpg123', ['-4m', '--8bit', '--wav', outputname, inputname])
		decoder = decoders[inputname] = {proc: proc, output: outputname}
		proc.once 'exit', (code, signal) ->
			if code == 0
				onFinish(outputname)
			else
				onFinish(false)
		#file = fs.createWriteStream(outputname)
		#require('util').pump(proc.stdout, file)


renderPNG = (filename, options, callback) ->
	canvas = ctx = null
	i = step = size = 0
	max = min = sqsum = 0
	options ?= {}
	width = if options.width? and options.width > 0 then options.width else 400
	height = if options.height? and options.height > 0 then options.height else 200

	data_max = []
	data_min = []
	data_rms = []
	multi = height / 256
	mid = height / 2
	clock = null
	onData = (n) ->
		if i > 43
			if (i % step) == 0
				data_max.push(max * multi + mid)
				data_min.push(min * multi + mid)
				data_rms.push(Math.sqrt(sqsum/step) * multi)
				max = min = sqsum = 0
			if (n > max) then max = n
			if (n < min) then min = n
			sqsum += n*n

		i++

	fs.stat filename, (err, stats) ->
		if (err or !stats or !stats.isFile() )
			#Error
			console.error(err, stats)
		else
			canvas = new Canvas(width, height)
			ctx = canvas.getContext('2d')
			size = stats.size
			step = Math.ceil(size/width)
			#clock = Profile("Render")
			stream = fs.createReadStream(filename)
			stream.on 'data', (data) ->
				onData (d - 128) for d in data
					
			stream.on 'end', renderEnvelopes
		return null
	
	renderEnvelopes = ->
		count = data_rms.length - 1
		ctx.moveTo(0, mid)
		ctx.beginPath()
		x = 0
		while x <= count
			ctx.lineTo(x, data_max[x])
			x++
		x = count
		while x >= 0
			ctx.lineTo(x, data_min[x])
			x--
		x = 0
		ctx.closePath()
		ctx.fillStyle = 'rgb(250,210,210)'
		ctx.fill()
		
		ctx.beginPath()
		x=0
		while x <= count
			ctx.lineTo(x, data_rms[x] + mid)
			x++
		x = count
		while x >= 0
			ctx.lineTo(x, mid - data_rms[x])
			x--
		ctx.closePath()
		ctx.fillStyle = 'rgb(150,30,30)'
		ctx.fill()
		
		stream = canvas.createPNGStream()
		callback(stream) if callback?
		return null
	return null
		
exports.decodemp3 = decodemp3
exports.renderPNG = renderPNG
