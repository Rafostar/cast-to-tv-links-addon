var fs = require('fs');
var ffprobe = require('./ffprobe-sync');
var { spawn } = require('child_process');
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
		case 'MUSIC':
			break;
		default:
			res.setHeader('Content-Type', 'video/x-matroska');
			res.setHeader('Connection', 'keep-alive');
			break;
	}

	var needsTranscoding = false;

	if(selection.streamType == 'VIDEO_ENCODE')
	{
		needsTranscoding = detectTranscoding();
	}

	if(!needsTranscoding)
	{
		if(selection.videoSrc && selection.audioSrc) mediaMerge(true).pipe(res);
		else if(selection.mediaSrc && selection.streamType == 'VIDEO_ENCODE') mediaMerge(false).pipe(res);
		else if(selection.mediaSrc) req.pipe(request.get(selection.mediaSrc)).pipe(res);
		else res.sendStatus(404);
	}
	else
	{
		if(selection.videoSrc && selection.audioSrc) videoEncode(true).pipe(res);
		else if(selection.mediaSrc) videoEncode(false).pipe(res);
		else res.sendStatus(404);
	}

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

function detectTranscoding()
{
	var mediaInfo = null;

	if(!selection.fps.actual || !selection.height.actual)
	{
		var source = (selection.videoSrc || selection.mediaSrc);
		mediaInfo = ffprobe(source, { path: config.ffprobePath }).streams[0];
	}

	if(mediaInfo)
	{
		if(!selection.fps.actual)
		{
			var fps = (mediaInfo.r_frame_rate || mediaInfo.avg_frame_rate);
			if(!fps) return true;

			if(typeof fps === 'string')
			{
				if(fps.includes('/')) fps = fps.split('/')[0];
			}

			selection.fps.actual = fps;
		}

		if(!selection.height.actual)
		{
			selection.height.actual = (mediaInfo.height || mediaInfo.coded_height);
		}
	}

	if(	selection.fps.actual > selection.fps.expected
		&& selection.height.actual >= selection.height.expected
	) {
		return true;
	}

	return false;
}

function mediaMerge(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var mergeOpts = [
	'-movflags', '+empty_moov',
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

function videoEncode(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var encodeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'libx264',
	'-vf',
	'fps=fps=30',
	'-pix_fmt', 'yuv420p',
	'-preset', 'superfast',
	'-level:v', '4.1',
	'-b:v', config.videoBitrate + 'M',
	'-maxrate', config.videoBitrate + 'M',
	'-c:a', 'copy',
	'-metadata', 'title=Cast to TV - Software Encoded Stream',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) encodeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else encodeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	streamProcess = spawn(config.ffmpegPath, encodeOpts,
	{ stdio: ['ignore', 'pipe', 'ignore'] });

	return streamProcess.stdout;
}
