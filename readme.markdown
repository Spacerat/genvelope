#Genvelope
...is a simple API and tool for creating images out of the waveforms of MP3 tracks.

## Dependencies 
*	node.js
*	express
*	jade
*	formidable
*	markdown-js (just for the index page)

## HTTP API
### GET /render/:format
#### Parameters
*	**format** - "html" or "png"
*	**url** - URL of an mp3 file to be downloaded by the server
*	**hash** sha1 ash of the filepointed to by the url paramter
*	**[width=400]** - optional, width of image
*	**[height=200]** - optional, height of image

### POST /render/:format
#### Body parameters
*	**format** - "html" or "png"
*	**file** - file data in the multipart/form-data body
*	**[width=400]** - optional, width of image
*	**[height=200]** - optional, height of image

### Format parameter
With format set to &quot;png&quot;, the result of the call is a 
HTTP redirect to the rendered image file.

With format set to &quot;html&quot;, the result of the call is a
HTTP redirect to a Successfully Uploaded Image page, which contains
a link to the image in an img tag.
