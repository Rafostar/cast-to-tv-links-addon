var fs = require('fs');
var spawn = require('child_process').spawn;
var request = require('request');

var config;
var selection;
var streamProcess;

exports.handleSelection = function(selectionContents, configContents)
{
	config = configContents;
	selection = selectionContents;
}

exports.closeStream = function()
{
	config = null;
	selection = null;
}

exports.fileStream = function(req, res)
{
	res.setHeader('Access-Control-Allow-Origin', '*');

	/* Set content type only when using local media merging,
	otherwise content type is piped from source through request */
	switch(selection.streamType)
	{
		case 'VIDEO':
		case 'PICTURE':
			break;
		default:
			if(!config.musicVisualizer) break;
			res.setHeader('Content-Type', 'video/x-matroska');
			res.setHeader('Connection', 'keep-alive');
			break;
	}

	if(selection.videoSrc && selection.audioSrc) mediaMerge(true).pipe(res);
	else if(selection.mediaSrc && selection.streamType == 'VIDEO_ENCODE') mediaMerge(false).pipe(res);
	else if(selection.mediaSrc) req.pipe(request.get(selection.mediaSrc)).pipe(res);
	else res.sendStatus(404);

	req.on('close', () =>
	{
		try { process.kill(streamProcess.pid, 'SIGHUP'); }
		catch(err) {}
	});
}

exports.subsStream = function(req, res)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	return req.pipe(request.get(selection.subsSrc)).pipe(res);
}

exports.coverStream = function(req, res)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Content-Type', 'image/png');

	var exist = fs.existsSync(selection.coverSrc);

	if(exist) return fs.createReadStream(selection.coverSrc).pipe(res);
	else res.sendStatus(204);
}

function mediaMerge(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var mergeOpts = [
	'-movflags', 'empty_moov',
	'-c', 'copy',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) mergeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else mergeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	streamProcess = spawn(config.ffmpegPath, mergeOpts,
	{ stdio: ['ignore', 'pipe', 'ignore'] });

	return streamProcess.stdout;
}
