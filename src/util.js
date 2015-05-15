module.exports = (function() {
	"use strict";

	var urllib = require('url');
	var _ = require('underscore');
	var isRelativeUrl = require('is-relative-url');

	var MultiCrawlerUtilFunctions = function() {
		var self = this;

		var _formatPathForMatch = function(path) {
			return path.replace(/^\/+/i, '').replace(/\/+$/i, '').toLowerCase();
		};

		this.isInPathMap = function(path, rootMap) {
			var _find = function(path, map) {
				if (_.has(map, path)) {
					return true;
				}
				var isFound = false;
				for (var key in map) {
					if (self.isMap(map[key])) {
						isFound = _find(path, map[key]);
						if (isFound) {
							return true;
						}
					}
				}
				return false;
			};
			return _find(path, rootMap);
		};

		this.searchPathMap = function(path, rootMap) {
			var _search = function(path, map) {
				var results = [],
					subResults;
				if (_.has(map, path)) {
					results.push(map)
				}
				for (var key in map) {
					if (self.isMap(map[key])) {
						subResults = _search(path, map[key]);
						if (subResults !== null && _.isArray(subResults)) {
							results = results.concat(subResults);
						}
					}
				}
				return (results.length > 0) ? results : null;
			};
			return _search(path, rootMap);
		};

		this.formatUrl = function(url) {
			return (url !== "/") ? url.replace(/\/+$/i, '').toLowerCase() : url;
		};

		this.formatParsedUrl = function(parsedUrl) {
			var baseUrl = parsedUrl.protocol + "://" + parsedUrl.host;
			if (parsedUrl.port !== 80) {
				baseUrl += ":" + parsedUrl.port;
			}
			return this.formatUrl(baseUrl + parsedUrl.path);
		};

		this.resolveDiscoveredPath = function(path, pageUrl) {
			if (isRelativeUrl(path)) {
				return this.formatUrl( urllib.resolve(pageUrl, path) );
			}
			return this.formatUrl(path);
		};

		this.isMap = function(obj) {
			return (!_.isUndefined(obj) && !_.isNull(obj) &&
					_.isObject(obj) && !_.isArray(obj) &&
					!_.isString(obj) && !_.isNumber(obj));
		};

		this.isRootPath = function(url, host, path) {
			if (url === "/") {
				return true;
			}
			var port;
			if (arguments.length > 3) {
				port = arguments[3];
			}
			var parsedUrl = urllib.parse(url);
			return (
				this.isHostMatch(host, parsedUrl.hostname) &&
				this.isPathMatch(path, parsedUrl.pathname) &&
				this.isPortMatch(port, parsedUrl.port)
			);
		};

		this.isOnHost = function(url, host) {
			var parsedUrl = urllib.parse(url);
			return this.isHostMatch(host, parsedUrl.hostname);
		};

		this.isOnPath = function(url, host, path) {
			// optional port argument
			var port;
			if (arguments.length > 3) {
				port = arguments[3];
			}
			var parsedUrl = urllib.parse(url);
			var _isPathDescendant = function(path, pathname) {
				var p = _formatPathForMatch(path) + "/",
					pn = _formatPathForMatch(pathname);
				return (pn.indexOf(p) === 0);
			};
			return (
				this.isHostMatch(host, parsedUrl.hostname) &&
				this.isPortMatch(port, parsedUrl.port) && 
				_isPathDescendant(path, parsedUrl.pathname)
			);
		};

		this.isHostMatch = function(host, hostname) {
			return (
				host === hostname ||
				hostname.toLowerCase().lastIndexOf("." + host.toLowerCase()) === (hostname.length - host.length - 1)
			);
		};

		this.isPortMatch = function(port, value) {
			var _parsePort = function(val) {
				if (!_.isUndefined(val) && !_.isNull(val)) {
					var intVal;
					if (!_.isNumber(val)) {
						intVal = parseInt(val);
					} else {
						intVal = val;
					}
					if (!_.isNaN(intVal) && intVal !== 80) {
						return intVal;
					}
				}
				return null;
			};
			var p = _parsePort(port),
				v = _parsePort(value);
			return (p === v);
		};

		this.isPathMatch = function(path, pathname) {
			return (
				path === pathname ||
				_formatPathForMatch(path) === _formatPathForMatch(pathname)
			);
		};
	};

	return new MultiCrawlerUtilFunctions();
})();