var fs = require('fs');
var ffprobe = require('./ffprobe-sync');
var { spawn } = require('child_process');
var request = require('request');
var debug = require('debug');
var links_debug = debug('links-addon');
var ffmpeg_debug = debug('ffmpeg');

var config;
var selection;
var streamProcess;
var stdioConf = 'ignore';

const downloadOpts = [
	'-multiple_requests', '1',
	'-seekable', '1',
	'-timeout', '100000',
	'-reconnect', '1',
	'-reconnect_streamed', '1',
	'-reconnect_at_eof', '1'
];

exports.handleSelection = function(selectionContents, configContents)
{
	config = configContents;
	selection = selectionContents;

	links_debug(`Obtained config: ${JSON.stringify(config)}`);
	links_debug(`Obtained selection: ${JSON.stringify(selection)}`);

	if(ffmpeg_debug.enabled) stdioConf = 'inherit';
}

exports.closeStream = function()
{
	config = null;
	selection = null;

	links_debug('Stream closed. Config and selection data wiped');
}

exports.fileStream = function(req, res)
{
	/* Prevent spawning more then one ffmpeg encode process */
	if(streamProcess)
	{
		links_debug('Stream in progress. Send status 429');
		res.statusCode = 429;
		res.end();
		return;
	}

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
		else return res.sendStatus(404);
	}
	else
	{
		var isSeparate;

		if(selection.videoSrc && selection.audioSrc) isSeparate = true;
		else if(selection.mediaSrc) isSeparate = false;
		else return res.sendStatus(404);

		if(config.videoAcceleration == 'none') videoEncode(isSeparate).pipe(res);
		else if(config.videoAcceleration == 'vaapi') vaapiEncode(isSeparate).pipe(res);
		else return res.end();
	}

	req.on('close', () =>
	{
		try { process.kill(streamProcess.pid, 'SIGHUP'); }
		catch(err) {}

		links_debug('Killed stream process');
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

	if(exist)
	{
		links_debug('Sending found media cover');
		return fs.createReadStream(selection.coverSrc).pipe(res);
	}
	else
	{
		links_debug('Cover not found. Send status 204');
		res.sendStatus(204);
	}
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
		links_debug('Media needs transcoding');
		return true;
	}

	links_debug('No transcoding is needed');
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

	mergeOpts = [...downloadOpts, ...mergeOpts];
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(mergeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, mergeOpts,
	{ stdio: [stdioConf, 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}

function videoEncode(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var encodeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'libx264',
	'-vf', 'fps=30',
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

	encodeOpts = [...downloadOpts, ...encodeOpts];
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(encodeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, encodeOpts,
	{ stdio: [stdioConf, 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}

function vaapiEncode(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var encodeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'h264_vaapi',
	'-vf', 'fps=30,format=nv12,hwmap',
	'-level:v', '4.1',
	'-b:v', config.videoBitrate + 'M',
	'-maxrate', config.videoBitrate + 'M',
	'-c:a', 'copy',
	'-metadata', 'title=Cast to TV - VAAPI Encoded Stream',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) encodeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else encodeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	encodeOpts = [...downloadOpts, ...encodeOpts];
	encodeOpts.unshift('-vaapi_device', '/dev/dri/renderD128');
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(encodeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, encodeOpts,
	{ stdio: [stdioConf, 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}
