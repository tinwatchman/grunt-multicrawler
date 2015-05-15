module.exports = (function() {
	"use strict";

	var Crawler = require('simplecrawler');
	var cheerio = require('cheerio');
	var chalk = require('chalk');
	var url = require('url');
	var EventEmitter = require('events').EventEmitter;
	var util = require('util');
	var _ = require('underscore');
	var isRelativeUrl = require('is-relative-url');

	var CrawlerController = function(options) {
		var self = this,
			crawler,
			pathMap = {};

		if (!_.has(options, "host")) {
			throw new Error("Host is required!");
		}

		this.siteName = _.has(options, 'name') ? options.name : options.host;
		this.host = options.host;
		this.path = _.has(options, 'path') ? options.path : "/";
		this.port = _.has(options, 'port') ? options.port : 80;
		this.isLockedToPath = _.has(options, 'lockToPath') ? options.lockToPath : true;
		this.isCheckingFragments = _.has(options, 'fragments') ? options.fragments : true;
		this.cookies = _.has(options, 'cookies') ? options.cookies : [];
		this.isComplete = false;

		// create crawler
		crawler = new Crawler(this.host, this.path, this.port);
		_.keys(options).forEach(function(key) {
			if (_.has(crawler, key) && key !== "host" && key !== "initialPath" && key !== "initialPort") {
				crawler[key] = options[key];
			}
		});
		if (this.cookies.length > 0) {
			this.cookies.forEach(function(cookie) {
				crawler.cookies.add(cookie);
			});
		}

		// import private utility functions
		
		var searchPathMap = require("./util").searchPathMap;
		var isInPathMap = require("./util").isInPathMap;
		var formatUrl = require("./util").formatUrl;
		var formatParsedUrl = require("./util").formatParsedUrl;
		var resolveDiscoveredUrl = require("./util").resolveDiscoveredPath;
		var isMap = require("./util").isMap;
		var isRootPath = require("./util").isRootPath;
		var isOnHost = require("./util").isOnHost;
		var isOnPath = require("./util").isOnPath;

		var setPathResult = function(path, value) {
			var formattedPath = formatUrl(path),
				pathReferences = searchPathMap(formattedPath, pathMap),
				cloneOrPassValue = function(val) {
					if (isMap(val)) {
						return _.clone(val);
					}
					return val;
				};
			if (pathReferences !== null) {
				_.each(pathReferences, function(ref) {
					if (_.isFunction(value)) {
						ref[ formattedPath ] = value.call(null, ref[formattedPath]);
					} else {
						ref[ formattedPath ] = cloneOrPassValue(value);
					}
				});
			} else if (isRootPath(path, this.host, this.path, this.port)) {
				ref[ formattedPath ] = (_.isFunction(value)) ? value.call(null, undefined) : cloneOrPassValue(value);
			}
		};

		// add crawler filters
		crawler.addFetchCondition(function(parsedUrl) {
			var url = formatParsedUrl(parsedUrl),
				isUrlKnown = isInPathMap(url, pathMap);
			if (
				(self.isLockedToPath && !isUrlKnown && !isOnPath(url, self.host, self.path, self.port)) || // if is path-locked and url isn't on path and isn't in the path map
				(!self.isLockedToPath && !isUrlKnown && !isOnHost(url, self.host)) // if not path-locked, but is an external link not already in the path map
			) {
				return false;
			}
			return true;
		});

		// add crawler event listeners
		crawler.on("discoverycomplete", function(queueItem, resources) {
			var pageUrl = formatUrl(queueItem.url),
				links = _.map(resources, function(value) {
					return resolveDiscoveredUrl(value, pageUrl);
				});
			// copy links into the path tree
			if (links.length > 0) {
				var linkMap = {};
				links.forEach(function(link) {
					linkMap[ link ] = "";
				});
				setPathResult(pageUrl, linkMap)
			}
		});
		crawler.on("fetchredirect", function(queueItem, parsedUrl, response) {
			var redirectObj = {
					'redirect': true,
					'statusCode': response.statusCode,
				},
				redirectUrl = formatParsedUrl(parsedUrl);
			redirectObj[redirectUrl] = "";
			setPathResult(queueItem.url, redirectObj);
			self.emit('redirect', queueItem.url, redirectUrl);
		});
		crawler.on("fetch404", function(queueItem, response) {
			setPathResult(queueItem.url, 404);
			self.emit('not_found', queueItem.url);
		});
		crawler.on("fetcherror", function(queueItem, response) {
			setPathResult(queueItem.url, response.statusCode);
			self.emit('http_error', queueItem.url, response.statusCode, response.statusMessage);
		});
		crawler.on("fetchdataerror", function(queueItem, response) {
			setPathResult(queueItem.url, "dataerror");
			self.emit('data_error', queueItem.url, response.statusCode, response.headers);
		});
		crawler.on("gziperror", function(queueItem, err) {
			setPathResult(queueItem.url, "gziperror");
			self.emit('gzip_error', queueItem.url, err);
		});
		crawler.on("fetchclienterror", function(queueItem, err) {
			setPathResult(queueItem.url, "clienterror");
			self.emit('client_error', queueItem.url, err);
		});
		crawler.on("queueerror", function(errorData, urlData) {
			self.emit('queue_error', errorData, urlData);
		});
		crawler.on("fetchcomplete", function(queueItem, responseBuffer) {
			// handle fragments, if that option is turned on
			var isFragmentUrl = false;
			if (self.isCheckingFragments) {
				var html = responseBuffer.toString();
				var $ = cheerio.load(html);

				$('a[href*="#"]').each(function(i, anchor) {
					crawler.queueURL($(anchor).attr('href'), queueItem);
				});

				if (queueItem.url.indexOf('#') !== -1) {
					try {
						if ($(queueItem.url.slice(queueItem.url.indexOf('#'))).length === 0) {
							setPathResult(queueItem.url, 'fragment_not_found');
							self.emit('fragment_not_found', queueItem.url);
						}
					} catch (e) {
						setPathResult(queueItem.url, 'bad_fragment');
						self.emit('bad_fragment', queueItem.referrer, queueItem.url);
					}
				}
			} else if (!self.isCheckingFragments || queueItem.url.indexOf('#') === -1) {
				setPathResult(queueItem.url, function(oldValue) {
					if (_.isString(oldValue) && _.isEmpty(oldValue)) {
						// if url is currently set to ""
						return true;
					}
					return oldValue;
				});
			}
		});
		crawler.on('complete', function() {
			self.isComplete = true;
			self.emit('complete', pathMap);
		});

		// run EventEmitter constructor
		EventEmitter.call(this);

		// public functions
		
	};
	CrawlerController.prototype = {};

	util.inherits(CrawlerController, EventEmitter);

})();