import asar from 'asar'
import fs from 'fs'
import path from 'path'

(function() {
	console.log('RUNNING ASAR INJECTION')

	let node_module;
	try {
		node_module = require('module');
	} catch (_) {
		node_module = null;
	}

	function splitPath(p: any) {
		console.log('splitPath', p)
		if (typeof p !== 'string') { return [false]; }
		if (p.substr(-5) === '.asar') { return [true, p, '']; }
		const index = p.lastIndexOf('.asar' + path.sep);
		if (index === -1) { return [false]; }
		return [true, p.substr(0, index + 5), p.substr(index + 6)];
	}

	let nextInode = 0;
	const uid = process.getuid != null ? process.getuid() : 0;
	const gid = process.getgid != null ? process.getgid() : 0;
	const fakeTime = new Date();
  
	function asarStatsToFsStats (stats: any) {
		console.log('asarStatsToFsStats')
		const isFile = !stats.files;
		return {
			dev: 1,
			ino: ++nextInode,
			mode: 33188,
			nlink: 1,
			uid: uid,
			gid: gid,
			rdev: 0,
			atime: stats.atime || fakeTime,
			birthtime: stats.birthtime || fakeTime,
			mtime: stats.mtime || fakeTime,
			ctime: stats.ctime || fakeTime,
			size: stats.size,
			isFile: function() { return isFile; },
			isDirectory: function() { return !isFile; },
			isSymbolicLink: function() { return false; },
			isBlockDevice: function() { return false; },
			isCharacterDevice: function() { return false; },
			isFIFO: function() { return false; },
			isSocket: function() { return false; }
		};
	}

	const readFileSync = fs.readFileSync;

	fs.readFileSync = function(p: any, options: any) {
		console.log('readFileSync')
		const _ref = splitPath(p);
		const isAsar = _ref[0];
		const asarPath = _ref[1];
		const filePath = _ref[2];
    
		if (!isAsar) { return readFileSync.apply(this, arguments as any); }
    
		if (!options) {
			options = { encoding: null, flag: 'r' };
		} else if (typeof options === 'string') {
			options = { encoding: options, flag: 'r' };
		} else if (typeof options !== 'object') {
			throw new TypeError('Bad arguments');
		}
    
		const content = asar.extractFile(asarPath, filePath);
		if (options.encoding) {
			return content.toString(options.encoding);
		} else {
			return content;
		}
	};

	const statSync = fs.statSync;

	(fs.statSync as any) = function (p: any) {
		console.log('statSync')
		const _ref = splitPath(p);
		const isAsar = _ref[0];
		const asarPath = _ref[1];
		const filePath = _ref[2];
    
		if (!isAsar) { return statSync.apply(this, arguments as any); }
		return asarStatsToFsStats(asar.statFile(asarPath, filePath));
	};

	const realpathSync = fs.realpathSync;

	(fs.realpathSync as any) = function (p: any) {
		console.log('realpathSync')
		const _ref = splitPath(p);
		const isAsar = _ref[0];
		const asarPath = _ref[1];
		let filePath = _ref[2];

		if (!isAsar) { return realpathSync.apply(this, arguments as any); }
		const stat = asar.statFile(asarPath, filePath);
		if (stat.link) { filePath = stat.link; }
		return path.join(realpathSync(asarPath as any), filePath as any);
	};

	if (node_module && node_module._findPath) {
		const module_findPath = node_module._findPath;
		node_module._findPath = function(request: any) {
			const _ref = splitPath(request);
			const isAsar = _ref[0];
			if (!isAsar) { return module_findPath.apply(this, arguments); }
			return request;
		};
	}

}).call(this);
