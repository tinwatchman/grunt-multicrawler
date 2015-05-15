describe("MultiCrawlerUtilFunctions", function() {
	var util = require("../src/util");

	describe("searchPathMap", function() {
		it("should return all references to the given path in a map", function() {
			var testMap = {
				"/": {
					"/something/somepath": true,
					"/something/otherpath": {
						"/something/somepath": true
					}
				}
			};
			var results = util.searchPathMap("/something/somepath", testMap);
			expect(results.length).toEqual(2);
			expect(results).toContain(testMap["/"]);
			expect(results).toContain(testMap["/"]["/something/otherpath"]);
		});

		it("should pass results by *reference*", function() {
			var path = "/something/somepath",
				testMap = {
					"/": {
						"/something/somepath": true,
						"/something/otherpath": {
							"/something/somepath": true
						}
					}
				};
			var results = util.searchPathMap(path, testMap);
			results[0][path] = false;
			results[1][path] = 404;
			expect(testMap["/"][path]).toBe(false);
			expect(testMap["/"]["/something/otherpath"][path]).toBe(404);
		});
	});

	describe("isInPathMap", function() {
		it("should return true if path exists in map", function() {
			var testMap = {
				"/": {
					"/something": true,
					"/somethingElse": {
						"/somethingElse/nothing": true,
						"/somethingElse/level3": {
							"/somethingElse/level3/someOtherThing": "",
							"/somethingElse/level3/target": ""
						}
					}
				}
			};
			expect(util.isInPathMap("/somethingElse/level3/target", testMap)).toBe(true);
		});

		it("should return false if path does not exist in map", function() {
			var testMap = {
				"/": {
					"/something": true,
					"/somethingElse": {
						"/somethingElse/nothing": true,
						"/somethingElse/level3": {
							"/somethingElse/level3/someOtherThing": "",
							"/somethingElse/level3/nope": ""
						}
					}
				}
			};
			expect(util.isInPathMap("/somethingElse/level3/nada", testMap)).toBe(false);
		});
	});

	describe("formatUrl", function() {
		it("should remove trailing slashes and lowercase everything", function() {
			expect(util.formatUrl("http://www.something.com/somepath/")).toEqual("http://www.something.com/somepath");
			expect(util.formatUrl("http://www.something.com/SomePath")).toEqual("http://www.something.com/somepath");
			expect(util.formatUrl("http://something.com//")).toEqual("http://something.com");
			expect(util.formatUrl("/")).toEqual("/");
		});
	});

	describe("resolveDiscoveredPath", function() {
		it("should be able to resolve relative URLs", function() {
			var pageUrl = "http://jonstout.net/somepath",
				path = "/somepath/somewhere/something/index.html";
			expect(util.resolveDiscoveredPath(path, pageUrl)).toEqual("http://jonstout.net/somepath/somewhere/something/index.html");
		});

		it("should be able to resolve relative URLs when given only a / symbol for the base", function() {
			var pageUrl = "/",
				path = "/somepath/index.php";
			expect(util.resolveDiscoveredPath(path, pageUrl)).toEqual("/somepath/index.php");
		});

		it("should be able to resolve URLs given relative to the site root", function() {
			var pageUrl = "http://www.jonstout.net/somepath",
				path = "/someotherpath/somewhere/something.js";
			expect(util.resolveDiscoveredPath(path, pageUrl)).toEqual("http://www.jonstout.net/someotherpath/somewhere/something.js");
		});

		it("shouldn't be confused by external links", function() {
			var pageUrl = "http://www.jonstout.net/somepath/index.html",
				path = "http://www.github.com/tinwatchman/something";
			expect(util.resolveDiscoveredPath(path, pageUrl)).toEqual("http://www.github.com/tinwatchman/something");
		});
	});

	describe("isMap", function() {
		it("should be able to tell an object apart from subclasses of object (arrays, strings, etc.)", function() {
			expect(util.isMap({"0":"1"})).toBe(true);
			expect(util.isMap([0])).toBe(false);
			expect(util.isMap("0")).toBe(false);
			expect(util.isMap(0)).toBe(false);
			expect(util.isMap([{"0":"1"}])).toBe(false);
		});
	});

	describe("formatParsedUrl", function() {
		it("should turn simplecrawler's parsed URL objects into actual URLs", function() {
			var sampleObj = {
				protocol: 'http',
				host: 'server.local',
				port: 80,
				path: '/community/selling/Demonstration/',
				uriPath: '/community/selling/Demonstration/',
				depth: 4
			};
			expect(util.formatParsedUrl(sampleObj)).toEqual("http://server.local/community/selling/demonstration");
		});

		it("should be able to handle ports other than 80", function() {
			var sampleObj = {
				protocol: 'http',
				host: 'localhost',
				port: 8008,
				path: '/community/selling/Demonstration/index',
				uriPath: '/community/selling/Demonstration/index',
				depth: 4
			};
			expect(util.formatParsedUrl(sampleObj)).toEqual("http://localhost:8008/community/selling/demonstration/index");
		});
	});

	describe("isRootPath", function() {
		it("should be able to tell if a URL represents the given host and path", function() {
			var url = "http://www.jonstout.net/something/something",
				host = "jonstout.net",
				path = "/something/something";
			expect(util.isRootPath(url, host, path)).toBe(true);
		});

		it("should be able to match ports", function() {
			var url = "http://www.jonstout.net:8008/something/something",
				host = "jonstout.net",
				path = "/something/something",
				port = "8008";
			expect(util.isRootPath(url, host, path, port)).toBe(true);
		});

		it("should be able to tell when ports don't match", function() {
			var url = "http://www.jonstout.net/something/something",
				host = "jonstout.net",
				path = "/something/something",
				port = "8008";
			expect(util.isRootPath(url, host, path, port)).toBe(false);
		});

		it("should be able to tell when paths don't match", function() {
			var url = "http://www.jonstout.net/something/index.html",
				host = "jonstout.net",
				path = "/something/something";
			expect(util.isRootPath(url, host, path)).toBe(false);
		});
	});
	
	describe("isOnHost", function() {
		it("should be able to tell when a URL is and is not on the given host", function() {
			var url1 = "http://www.jonstout.net/something",
				url2 = "http://www.jonstout.com/something",
				host = "jonstout.net";
			expect(util.isOnHost(url1, host)).toBe(true);
			expect(util.isOnHost(url2, host)).toBe(false);
		});

		it("should also work with subdomains", function() {
			var url = "http://test.jonstout.net/something",
				host = "jonstout.net";
			expect(util.isOnHost(url, host)).toBe(true);
		});
	});
	describe("isOnPath", function() {
		it("should be able to tell if a URL is on or part of the given path", function() {
			var url = "https://www.jonstout.net/something/index.html",
				host = "www.jonstout.net",
				path = "/something";
			expect(util.isOnPath(url, host, path)).toBe(true);
		});

		it("should be able to tell if the path is actually a descendant of the given path", function() {
			var url = "https://www.jonstout.net/somethingelse/something.html",
				host = "www.jonstout.net",
				path = "/something";
			expect(util.isOnPath(url, host, path)).toBe(false);
		});
	});
});