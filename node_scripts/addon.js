var fs = require('fs');
var { spawn } = require('child_process');
var request = require('request');
var debug = require('debug');
var links_debug = debug('links-addon');
var ffmpeg_debug = debug('ffmpeg');
var randomAgent = require('./random-agent');

var isDirect = false;
var isStreaming = false;
var streamData = null;

const stdioConf = (ffmpeg_debug.enabled) ? 'inherit' : 'ignore';

exports.handleSelection = function(selection, config)
{
	isDirect = false;

	links_debug(`Obtained config: ${JSON.stringify(config)}`);
	links_debug(`Obtained selection: ${JSON.stringify(selection)}`);
}

exports.closeStream = function()
{
	if(streamData && !streamData.destroyed)
	{
		streamData.destroy();
		streamData = null;

		links_debug('Stream data destroyed');
	}
}

exports.fileStream = function(req, res, selection, config)
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

	var isSeparate = (selection.videoSrc && selection.audioSrc) ?
		true : (selection.mediaSrc) ? false : null;

	if(isSeparate === null)
	{
		links_debug(`Invalid or missing selection info!`);
		return res.sendStatus(404);
	}
	links_debug(`Separate video and audio tracks: ${isSeparate}`);

	if(isSeparate || selection.streamType == 'VIDEO_ENCODE')
	{
		links_debug('Media will be passed through FFmpeg');
		mediaMerge(req, res, selection, config, isSeparate);
	}
	else
	{
		links_debug('Direct media streaming');
		isDirect = true;
		req.pipe(request.get(selection.mediaSrc)).pipe(res);
	}
}

exports.subsStream = function(req, res, selection, config)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	return req.pipe(request.get(selection.subsSrc)).pipe(res);
}

exports.coverStream = function(req, res, selection, config)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Content-Type', 'image/png');

	fs.access(selection.coverSrc, fs.constants.F_OK, (err) =>
	{
		if(err)
		{
			links_debug('Cover not found. Send status 204');
			res.sendStatus(204);
		}
		else
		{
			links_debug('Sending found media cover');
			fs.createReadStream(selection.coverSrc).pipe(res);
		}
	});
}

function getDownloadOpts()
{
	return [
		'-user_agent', randomAgent(),
		'-multiple_requests', '0',
		'-seekable', '1',
		'-timeout', '195000',
		'-reconnect', '1',
		'-reconnect_streamed', '1',
		'-reconnect_at_eof', '0',
		'-reconnect_delay_max', '0'
	];
}

function mediaMerge(req, res, selection, config, isSeparate)
{
	var mergeOpts = getPlayerOptsArray(config.receiverType);

	if(isSeparate)
	{
		const downloadOpts = getDownloadOpts();
		mergeOpts.unshift(...downloadOpts, '-i', 'async:cache:' + selection.videoSrc,
			...downloadOpts, '-i', 'async:cache:' + selection.audioSrc, '-c:a', 'copy');
	}
	else
		mergeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-c:a', 'aac', '-ac', '2');

	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(mergeOpts)}`);
	isStreaming = true;

	var streamProcess = spawn(config.ffmpegPath, mergeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	streamData = streamProcess.stdout;

	/* Increase download buffer to 16MB */
	streamData._readableState.highWaterMark = 1024 * 1024 * 16;

	const onStreamClose = function(code)
	{
		isStreaming = false;

		if(code !== null)
			links_debug(`FFmpeg exited with code: ${code}`);

		links_debug('FFmpeg closed');
	}

	const onReqClose = function()
	{
		/* Destroys the buffer and causes ffmpeg exit */
		exports.closeStream();

		links_debug('HTTP request closed');
	}

	streamProcess.once('exit', onStreamClose);
	req.once('close', onReqClose);

	streamData.pipe(res);
}

function getPlayerOptsArray(receiverType)
{
	if(receiverType !== 'playercast')
	{
		return [
			'-frag_duration', '1000000',
			'-movflags', '+empty_moov',
			'-strict', '-2',
			'-f', 'mp4',
			'pipe:1'
		];
	}

	return [
		'-movflags', '+empty_moov',
		'-f', 'matroska',
		'pipe:1'
	];
}
