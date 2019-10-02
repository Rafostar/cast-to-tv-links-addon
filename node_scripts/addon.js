var fs = require('fs');
var { spawn } = require('child_process');
var request = require('request');
var debug = require('debug');
var links_debug = debug('links-addon');
var ffmpeg_debug = debug('ffmpeg');

var config;
var selection;
var isDirect;
var isStreaming;
var streamProcess = {};

const stdioConf = (ffmpeg_debug.enabled) ? 'inherit' : 'ignore';

const downloadOpts = [
	'-user_agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36',
	'-multiple_requests', '0',
	'-seekable', '1',
	'-timeout', '200000',
	'-reconnect', '1',
	'-reconnect_streamed', '1',
	'-reconnect_at_eof', '0',
	'-reconnect_delay_max', '0'
];

exports.handleSelection = function(selectionContents, configContents)
{
	config = configContents;
	selection = selectionContents;
	isDirect = false;

	links_debug(`Obtained config: ${JSON.stringify(config)}`);
	links_debug(`Obtained selection: ${JSON.stringify(selection)}`);
}

exports.closeStream = function()
{
	if(isStreaming && streamProcess.exitCode === null)
	{
		process.kill(streamProcess.pid, 'SIGHUP');
		links_debug(`Send close signal to stream process`);
	}

	isStreaming = false;
	links_debug('Stream closed. Config and selection data wiped');
}

exports.fileStream = function(req, res)
{
	/* Prevent spawning more then one ffmpeg encode process */
	if(isStreaming)
	{
		links_debug('Stream in progress. Send status 429');
		return res.sendStatus(429);
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

	if(isDirect)
	{
		links_debug(`New http request: ${req.headers.range}`);
		return req.pipe(request.get(selection.mediaSrc)).pipe(res);
	}

	var isSeparate = (selection.videoSrc && selection.audioSrc) ? true : (selection.mediaSrc) ? false : null;
	if(isSeparate === null)
	{
		links_debug(`Invalid or missing selection info!`);
		return res.sendStatus(404);
	}
	links_debug(`Separate video and audio tracks: ${isSeparate}`);

	if(isSeparate || selection.streamType == 'VIDEO_ENCODE')
	{
		links_debug('Media will be passed through FFmpeg');
		isStreaming = true;
		mediaMerge(isSeparate).pipe(res);
	}
	else
	{
		links_debug('Direct media streaming');
		isDirect = true;
		req.pipe(request.get(selection.mediaSrc)).pipe(res);
	}

	req.once('close', exports.closeStream);
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

function mediaMerge(isSeparate)
{
	var mergeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'copy',
	'-f', 'matroska',
	'pipe:1'
	];

	if(isSeparate)
	{
		mergeOpts.unshift(...downloadOpts, '-i', 'async:cache:' + selection.videoSrc,
			...downloadOpts, '-i', 'async:cache:' + selection.audioSrc, '-c:a', 'copy');
	}
	else
		mergeOpts.unshift(...downloadOpts, '-i', 'async:cache:' + selection.mediaSrc, '-c:a', 'aac', '-ac', '2');

	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(mergeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, mergeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	/* Increase download buffer to 16MB */
	streamProcess.stdout._readableState.highWaterMark = 1024 * 1024 * 16;

	streamProcess.once('close', (code) =>
	{
		isStreaming = false;

		if(code !== null)
			links_debug(`FFmpeg exited with code: ${code}`);

		streamProcess.removeListener('error', links_debug);
		links_debug('FFmpeg closed');
	});

	streamProcess.once('error', links_debug);
	return streamProcess.stdout;
}
