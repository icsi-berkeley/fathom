var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
/*(function() {
	Components.utils.import("resource://fathom/storage.jsm");

	var aboutFathom = {
		listener: function(evt) {
			var origin = evt.target.ownerDocument.documentURI;
			if(os == "Android") {
				if (fathom_toggleHelpers.getCurrentStatus() && (origin.match(/^about:neterror/) ||
						origin.match(/^about:certerror/))) {
					let params = {
						selected: true
					};
					BrowserApp.addTab("about:fathom", params);
				}
			} else {
				if (fathom_helpers.status() && (origin.match(/^about:neterror/) ||
						origin.match(/^about:certerror/)))
					gBrowser.selectedTab = gBrowser.addTab("about:fathom");
			}
		}
	}
	document.addEventListener("AboutFathomEvent", function(e) {
		aboutFathom.listener(e);
	}, false, true);

	var updateHTML = {
		listener: function(evt) {
			var origin = evt.target.ownerDocument.documentURI;
			if(os == "Android") {
				var status = fathom_toggleHelpers.getCurrentStatus();
			} else {
				var status = fathom_helpers.status();
			}
			if (status && (origin.match(/^about:neterror/) ||
					origin.match(/^about:certerror/))) {
				var html = evt.target.getAttribute("html");
		      	var location = evt.target.ownerDocument.location.href.toString();
		      	fathomDataStore.setItem("html=#@#=" + location, html);
			}
		}
	}
	document.addEventListener("UpdateHTML", function(e) {
		updateHTML.listener(e);
	}, false, true);

	var updateJSON = {
		listener: function(evt) {
			var origin = evt.target.ownerDocument.documentURI;
			if(os == "Android") {
				var status = fathom_toggleHelpers.getCurrentStatus();
			} else {
				var status = fathom_helpers.status();
			}
			if (status && (origin.match(/^about:neterror/) ||
					origin.match(/^about:certerror/))) {
				var num = evt.target.getAttribute("num");
		      	var json = evt.target.getAttribute("json");
		      	var location = evt.target.ownerDocument.location.href.toString();
		      	fathomDataStore.setItem("json=#@#=" + num + "=#@#=" + location, JSON.parse(json));
			}
		}
	}
	document.addEventListener("UpdateJSON", function(e) {
		updateJSON.listener(e);
	}, false, true);
	
})();*/

(function() {

	var Ci = Components.interfaces;
	var Cc = Components.classes;
	var Cu = Components.utils;

	Cu.import("resource://gre/modules/FileUtils.jsm");

	var upload = {

		POST_URL: "http://fathom.icsi.berkeley.edu/upload.php",

		getKey: function(desc) {
	
			var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
			var id = pref.getCharPref("extensions.fathom.installationID");
	
			return id + "==" + desc + "==" + Date.now();
		},

		file: function(name) {
			// zip the file
			var zipFile = FileUtils.getFile("TmpD", ["tmp.zip"], false);
			if (zipFile.exists()) {
				zipFile.remove(false);
			}
			zipFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);
		
			var savedFile = FileUtils.getFile("ProfD", [name]);
			var zipWriter = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
			zipWriter.open(zipFile, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
			zipWriter.addEntryFile(name, zipWriter.COMPRESSION_BEST, savedFile, false);
			zipWriter.close();
		
			// send the zip file
			upload.send(upload.getKey(name), "/tmp/tmp.zip", upload.POST_URL, true);
		},
	
		send: function(key, data, url, isFile) {
	
			var formData = new FormData();
			formData.append('key', key);
			formData.append('result', (isFile ? new File(data) : data));
	
			var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);  
			req.open('POST', url, true);

			req.onreadystatechange = function() {
				if(req.readyState == 4) {
					if(req.status == 200)
						dump(req.responseText);
				}
			};
		
			req.send(formData);  
		}

	};

	var uploadFiles = {
		listener: function(evt) {
			var origin = evt.target.ownerDocument.documentURI;
			if (fathom_helpers.status() && (origin.match(/^about:neterror/) ||
					origin.match(/^about:certerror/))) {
				var file = evt.target.getAttribute("path");		
				upload.file(file);
			}
		}
	}
	
	document.addEventListener("UploadFileEvent", function(e) {
		uploadFiles.listener(e);
	}, false, true);

})();


/*----------------------------------------------------------------------------*/

var loadUtils = {
	initAll: function(doc, parent, cause, uri) {
		var str = 'var manifest = { \
				"api" : [ \
					"socket.*", \
					"proto.*", \
					"system.*", \
					"util.*", \
				], \
				"destinations" : [ \
					"" \
				] \
			}; \
			window.fathom.init(function(arg) { }, manifest, window); \
			var NetErrorTestID = Math.random().toString(36).slice(-8); \
			var DebugTestID = null; \
			window.fathom.util.insertTables("netError", "testid", NetErrorTestID); \
			window.fathom.util.updateTables(NetErrorTestID, "netError", "uri", "' + uri + '"); \
			window.fathom.util.updateTables(NetErrorTestID, "netError", "cause", "' +  cause + '");';

		loadUtils.loadScript(doc, parent, str);
		
		loadUtils.loadCSS(doc, parent, ["connectivity tree/ui/css/spinner.css", "connectivity tree/ui/css/table.css"]);

		loadUtils.loadScripts(doc, parent, [
			"connectivity tree/utils/collapse.js",
			"connectivity tree/ui/libs/jquery/jquery-1.7.2.js",
			"connectivity tree/utils/display.js",
			//
			"connectivity tree/utils/log.js",
			"connectivity tree/utils/base.js",
			"connectivity tree/utils/new_tree.js",
			"connectivity tree/utils/init.js",
			//
			"connectivity tree/tests/http/dns/lookup.js",
			"connectivity tree/tests/http/uri.js",
			//
			"connectivity tree/globals.js",
		]);
	},
	
	loadCSS: function(doc, parent, list) {
		for(var i = 0; i < list.length; i++) {
			var elem = doc.createElement("link");
			elem.rel = "stylesheet";
			elem.type = "text/css";
			elem.href = "chrome://fathom/content/" + list[i];
			parent.appendChild(elem);
		}
	},
	
	loadScripts: function(doc, parent, list) {
		for(var i = 0; i < list.length; i++) {
			var elem = doc.createElement("script");
			elem.type = "application/javascript";
			elem.src = 'chrome://fathom/content/' + list[i];
			parent.appendChild(elem);
		}
	},
	
	loadScript: function(doc, parent, text) {
		var elem = doc.createElement("script");
		elem.text = text;
		parent.appendChild(elem);
	},
	
	initScript: function(doc, parent, dir, list) {
		var path = "chrome://fathom/content/connectivity tree/" + dir + "/";
		for(var i = 0; i < list.length; i++) {
			
			var xhr = new XMLHttpRequest();
			xhr.open('GET', path + list[i] + ".js", false);
			xhr.overrideMimeType("text/plain");
			xhr.send(null);
			
			loadUtils.loadScript(doc, parent, "var _text_" + list[i] + "_js = " + eval(xhr.responseText) + ";");
		}
	},
	
	customEvent: function(name, doc) {
		var str = 'function ' + name + '(path) { \
			var element = document.createElement("' + name + 'Element"); \
			element.setAttribute("path", path); \
			document.documentElement.appendChild(element); \
			\
			var evt = document.createEvent("Events"); \
			evt.initEvent("' + name + 'Event", true, false); \
			element.dispatchEvent(evt); \
		}';

		loadUtils.loadScript(doc, doc.body, str);
	}
};

var showOptions = {

	onLoad:function() {
		window.removeEventListener('load', showOptions.onLoad, false);

		if(os == "Android") {
			window.document.getElementById('browsers').addEventListener(
				'DOMContentLoaded', showOptions.contentDomLoad, false);
		} else {
			window.document.getElementById('appcontent').addEventListener(
				'DOMContentLoaded', showOptions.contentDomLoad, false);
		}
	},

	contentDomLoad:function(event) {
		var contentDoc = event.target;
		var contentWin = contentDoc.defaultView;

		if(os == "Android") {
			var status = fathom_toggleHelpers.getCurrentStatus();
		} else {
			var status = fathom_helpers.status();
		}

		if (status && 
				(contentDoc.documentURI.match(/^about:neterror/) ||
				contentDoc.documentURI.match(/^about:certerror/))) {

			// get cause, uri
			var cause = contentDoc.documentURI.split("=")[1].split("&")[0];
			var uri = contentDoc.documentURI.match(/&u=.*&c=/g);
			if(uri)
				uri = unescape(uri[0].substring(3, uri[0].length - 3));

			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'chrome://fathom/content/netError.xhtml', false);
			xhr.send(null);
			
			var response = xhr.responseXML;
			
			var div = contentDoc.createElement("div");
			div.className = "result";
			div.id = "result";

			/* Add a header programmatically. This is too complicated. --cpk */
			var hDiv = contentDoc.createElement("div");
			hDiv.className = 'fathomhdr';
			hDiv.id = 'fathomhdr';
			hDiv.innerHTML = 'Fathom analysis (<a href="#" onclick="refreshDisplay(false); return false;">Show All</a> | <a href="#" onclick="refreshDisplay(true); return false;">Show Problems</a>)';
			div.appendChild(hDiv);

			/* If the page has an errorPageContainer div, append to it --
			   looks better in Firefox's error pages. --cpk */
			var parent = contentDoc.getElementById('errorPageContainer');
			if (parent == null) {
				loadUtils.loadCSS(contentDoc,
						  contentDoc.getElementsByTagName('head')[0],
						  ["connectivity tree/ui/css/netalyzr.css"]);

				parent = contentDoc.body;
			} else {
				loadUtils.loadCSS(contentDoc,
						  contentDoc.getElementsByTagName('head')[0],
						  ["connectivity tree/ui/css/netalyzr-container.css"]);
			}
			parent.appendChild(div);

			var fathomDiv = response.getElementById('fathomresult');
			contentDoc.body.appendChild(fathomDiv);			
			loadUtils.initAll(contentDoc, fathomDiv, cause, uri);
			
			/* scripts for generic connectivity tests */
			loadUtils.initScript(contentDoc, fathomDiv, "tests/basic", ["interfaces", "active_interface", "auto_configuration", "nameserver"]);
			loadUtils.loadScripts(contentDoc, fathomDiv, ["connectivity tree/basic.js"]);
			
			/* scripts for network and transport level tests */
			if(os == "Android") {
				loadUtils.initScript(contentDoc, fathomDiv, "tests/network", ["routing_table"]);//, "traceroute"
			} else {
				loadUtils.initScript(contentDoc, fathomDiv, "tests/network", ["routing_table", "traceroute"]);
			}
			loadUtils.loadScripts(contentDoc, fathomDiv, ["connectivity tree/network.js"]);
			
			showOptions.performAction(contentDoc, fathomDiv, cause, uri);
			
			// code to upload file
			loadUtils.customEvent("UploadFile", contentDoc);
			var uploadDiv = contentDoc.createElement("div");
			uploadDiv.id = 'upload';
			uploadDiv.align = 'center';
			//uploadDiv.innerHTML = '<h4>Click <a href="#" onclick="UploadFile(\'baseline_netError.sqlite\'); return false;">here</a> to upload this debug session.</h4>';
			uploadDiv.innerHTML = '<table><tbody><tr><td style="padding-right:10px;vertical-align:top;"><a href="http://www.measurementlab.net" target="_top"><img src="chrome://fathom/content/icons/mlab-logo.jpg" alt="M-Lab" border="0"></img></a></td><td><i> Fathom uses the <a href="http://www.measurementlab.net" target="_top">Measurement Lab</a> (<a href="http://www.measurementlab.net" target="_top">M-Lab</a>) research platform.<br></br> To learn what information our tool collects, please go <a href="http://www.measurementlab.net/measurement-lab-tools#fathom">here</a>.</i></td></tr></tbody></table>';
			parent.appendChild(uploadDiv);
			
			var done = false;
			var timerID = setInterval(function() {
				if(done) {
					clearInterval(timerID);
					loadUtils.loadScript(contentDoc, parent, "UploadFile('baseline_netError.sqlite');");
				} else {
					// check if all tests are done
					var divs = contentDoc.getElementsByTagName("div");
					var total = 0;
					for(var i = 0; i < divs.length; i++) {
						if(divs[i].getAttribute('id') == "floatingBarsG")
							total++;
					}
					if(total == 0)
						done = true;
				}
			}, 500);
		}
	},
	
	performAction: function(doc, div, cause, uri) {
		switch(cause) {
			case "dnsNotFound":			// Firefox can't find the server at %S.
				/* scripts for DNS level tests */
				loadUtils.initScript(doc, div, "tests/dns", ["nameserver", "lookup_host", "lookup_host_cd", "lookup_public", "lookup_standard"]);
				// To test for CD option
				//loadUtils.loadScript(doc, div, "DNSserver = '149.20.64.20', domainName = 'www.dnssec-failed.org';");
				loadUtils.loadScript(doc, div, "domainName = (new Uri('" + uri + "')).host;");
				loadUtils.loadScripts(doc, div, ["connectivity tree/dns.js"]);
				break;
			case "fileNotFound":
				break;
			case "malformedURI":
				break;
			case "protocolNotFound":	// Firefox doesn't know how to open this address.
				break;
			case "notCached":			// This document is no longer available.
				break;
			case "deniedPortAccess":	// This address uses a network port which is normally used for purposes other than Web browsing.
				uri = "http:" + uri.split(":")[1];
			case "redirectLoop":		// Firefox has detected that the server is redirecting the request for this address in a way that will never complete.
			case "netOffline":			// Firefox is currently in offline mode and can't browse the Web.
			case "connectionFailure":	// Firefox can't establish a connection to the server at %S.
			case "netReset":			// The connection to the server was reset while the page was loading.
			case "netInterrupt":		// The connection to %S was interrupted while the page was loading.
			case "netTimeout":			// The server at %S is taking too long to respond.
			case "proxyResolveFailure":	// Firefox is configured to use a proxy server that can't be found.
			case "proxyConnectFailure":	// Firefox is configured to use a proxy server that is refusing connections.
			case "unknownSocketType":	// Firefox doesn't know how to communicate with the server.
				/* scripts for HTTP level tests */
				loadUtils.initScript(doc, div, "tests/http", ["reset", "entity", "local_proxy", "https", "connect_proxy", "another_site_via_proxy"]);
				loadUtils.loadScript(doc, div, "url = '" + uri + "';");
				loadUtils.loadScripts(doc, div, ["connectivity tree/http.js"]);		
				break;
			case "contentEncodingError":// The page you are trying to view cannot be shown because it uses an invalid or unsupported form of compression.
				break;
			case "unsafeContentType":	// The page you are trying to view cannot be shown because it is contained in a file type that may not be safe to open.
				break;
			case "nssFailure2":
				break;
			case "nssBadCert":
				break;
			case "cspFrameAncestorBlocked":
				break;
			case "remoteXUL":
				break;
			case "corruptedContentError":
				break;
			default:
				break;	
		}
	}
};

window.addEventListener('load', showOptions.onLoad, false);
