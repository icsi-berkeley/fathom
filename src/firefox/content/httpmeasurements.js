/* -*- mode: javascript; js-indent-level: 2; js-expr-indent-offset: 2; -*-
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (c) 2011-2012 International Computer Science Institute (ICSI).
 * All rights reserved.
 *
 * See LICENSE for license and terms of usage. 
 *
 * ***** END LICENSE BLOCK *****
 */

var resource = function(id, url) {
  this.id = id;
  this.url = url;
  this.rrt = 0;
  this.connectFlag = false;
  this.dnsFlag = false;
  this.dnsstart = 0;
  this.dnsstop = 0;
  this.connectstart = 0;
  this.connectstop = 0;
  this.sendstart = 0;
  this.sendstop = 0;
  this.waitstart = 0;
  this.waitstop = 0;
  this.httpstart = 0;
  this.httpstop = 0;
  this.size = 0;
  this.contentType = "";
};

resource.prototype = {
  id : null,
  url : null,
  rrt : null,
  connectFlag : null,
  dnsFlag : null,
  connectstart : null,
  connectstop : null,
  sendstart : null,
  sendstop : null,
  waitstart : null,
  waitstop : null,
  httpstart : null,
  httpstop : null,
  dnsstart: null,
  dnsstop : null,
  size : null,
  contentType : null
}

var page = function(id, win, url) {
  this.sessionid = id;
  this.window = win;
  this.url = url;
  this.httpstart = 0;
  this.httpstop = 0;
  this.domcontentloaded = 0;
  this.load = 0;
  this.resources = [];
  this.fathomTime = 0;
};

page.prototype = {
  sessionid : null,
  window : null,
  url : null,
  httpstart : null,
  httpstop : null,
  domcontentloaded : null,
  load : null,
  resources : null,
  fathomTime : null,
  addNewResource : function(url) {
    var id = this.resources.length;
    var res = new resource(id, url);
    this.resources.push(res);
    return res;
  },
  getResource : function(url) {
    for(var i = 0; i < this.resources.length; i++) {
      var res = this.resources[i];
      if(res.url == url) {
	return res;
      }
    }
    return null;
  }
}

var contexts = [];
var activeRequests = [];

const SESSION_LENGTH = 21;
const SESSION_TIMER = 2000;

var utils = {

  getWindowForRequest : function(aRequest) {
    var loadContext = this.getRequestLoadContext(aRequest);
    try {
      if (loadContext)
	return loadContext.associatedWindow;
    } catch (ex) {
    }
    return null;
  },
  
  getRootWindow : function(win) {
    for (; win; win = win.parent) {
      if (!win.parent || win == win.parent || !(win.parent instanceof Window))
        return win;
    }
    return null;
  },
  
  getContextByWindow: function(win) {
    if (!win)
      return;

    var rootWindow = this.getRootWindow(win);

    if (rootWindow) {
      for (var i = 0; i < contexts.length; ++i) {
        var context = contexts[i];
        if (context && context.window == rootWindow) {
          return context;
        }
      }
    }
  },
  
  setContextForWindow : function(win, ctx) {
    if (!win)
      return;

    var rootWindow = this.getRootWindow(win);

    if (rootWindow) {
      for (var i = 0; i < contexts.length; ++i) {
        var context = contexts[i];
        if (context && context.window == rootWindow) {
          contexts[i] = ctx;
          return;
        }
      }
      contexts.push(ctx);
    }
  },
  
  deleteContextByWindow : function(win) {
    if (!win)
      return;

    var rootWindow = this.getRootWindow(win);

    if (rootWindow) {
      for (var i = 0; i < contexts.length; ++i) {
        if (contexts[i] && contexts[i].window == rootWindow) {
          //Log("Deleting context for " + contexts[i].url);
          contexts[i] = null;
        }
      }
    }
  },
  
  // thanks to Firebug
  getRequestLoadContext : function(request) {
    try {
      if (request && request.notificationCallbacks) {
	return request.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
      }
    } catch (e) {
    }
    try {
      if (request && request.loadGroup && request.loadGroup.notificationCallbacks) {
	return request.loadGroup.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
      }
    } catch (e) {
    }
    return null;
  },
  
  getContextForDocument : function(doc) {
    for (var i = 0; i < contexts.length; ++i) {
      var context = contexts[i];
      try {
		  if (context && context.window.document == doc)
		    return context;
	  } catch(e) {
	  	return null;
	  }
    }
    return null;
  },
  
  getHostname : function(url) {
    var re = new RegExp('^(?:f|ht)tp(?:s)?\://([^/]+)', 'im');
    var match = url.match(re);
    if(match)
      return match[1].toString();
    return null;
  },
  
  countDomains : function(ctx) {
    if(ctx) {
      var url = ctx.url;
      var count = {};
      for(var i = 0; i < ctx.resources.length; i++) {
	var res = ctx.resources[i];
	var domain = this.getHostname(res.url);
	count[domain] = domain;
      }
      
      var tc = 0;
      for(var d in count)
	tc++;
      return tc;
    }
  },
  
  storeHistory : function(ctx) {
  	//dump("CTX == " + ctx.sessionid);
    if(ctx) {
		// use DOM localstorage for the domain
		var local = ctx.window.localStorage;
		var url = ctx.url;

		var session = function(load, domc, httpstart, httpstop, ts, state, res) {
			this.load = load;
			this.domcontentloaded = domc;
			this.httpstart = httpstart;
			this.httptotal = httpstop - httpstart;
			this.resources = res;
			this.ts = ts;
			this.documentstate = state;
		}

		session.prototype = {
			resources : null,
			load : null,
			httpstart : null,
			httptotal : null,
			domcontentloaded : null,
			ts : null,
			documentstate : null
		}
      
		var entry = new session(ctx.load, ctx.domcontentloaded, ctx.httpstart, ctx.httpstop, ctx.sessionid, ctx.window.document.readyState, ctx.resources);

		try {
			var ss = JSON.parse(local.getItem("session"));
			if(!ss)
				ss = [];
		} catch(e) {
			ss = [];
		}
		var flag = false;
		for(var i = 0; i < ss.length; i++) {
			if(ss[i].ts == entry.ts) {
				ss[i] = entry;
				flag = true;
				break;
			}
		}
		if(!flag) {
			if (ss.length == SESSION_LENGTH)
				ss.shift();
			else
				ss.push(entry);
		}
		try {
			// this clears baseline parameters stored in local storage in old Fathom versions
			local.removeItem("baseline");
		} catch(e) {
		}
		local.removeItem("session");
		local.setItem("session", JSON.stringify(ss));
	}
  }
};

/*----------------------------------------------------------------------------*/
var requestTime = 0;
var httpReqTime = 0;
var httpActivityTime = 0;
var ctxTime = 0;
var fTime = 0;

var Cc = Components.classes;
var Ci = Components.interfaces;

var nsIHttpActivityObserver = Ci.nsIHttpActivityObserver;
var nsISocketTransport = Ci.nsISocketTransport;

var httpObserver = {

  observeActivity: function(aHttpChannel, aActivityType, aActivitySubtype, aTimestamp, aExtraSizeData, aExtraStringData) {

    var fStart = Date.now();

    var time = new Date();
    time.setTime(aTimestamp/1000);
    time = time.getTime();
    
    aHttpChannel = aHttpChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
    var requestURL = aHttpChannel.URI.spec;
    if (! utils) 
      return;
    var win = utils.getWindowForRequest(aHttpChannel);
    // thanks to Firebug for the idea of active requests
    if (!win) {
      var index = activeRequests.indexOf(aHttpChannel);
      if (index == -1) {
        //Log("request index not found : " + requestURL)
        httpActivityTime += (Date.now() - fStart);
        //ctx.fathomTime += (Date.now() - fStart);
        fTime += (Date.now() - fStart);
        return;
      }

      if (!(win = activeRequests[index+1])) {
        //Log("cannot set window : requestURL = " + requestURL)
        httpActivityTime += (Date.now() - fStart);
        //ctx.fathomTime += (Date.now() - fStart);
        fTime += (Date.now() - fStart);
        return;
      }
    }

    var ctxStart = Date.now();
    var ctx = utils.getContextByWindow(win);
    
    if(ctx) {
      var tmp = ctx.getResource(requestURL);
      if(tmp == null) {
	tmp = ctx.addNewResource(requestURL);
      }
    } else {
      //Log("ctx = null : requestURL = " + requestURL);
      //ctx.fathomTime += (Date.now() - fStart);
      fTime += (Date.now() - fStart);
      //Log("1 fathom time = " + ctx.fathomTime);
      //httpActivityTime += (Date.now() - fStart);
      return;
    }
    
    ctxTime = Date.now() - ctxStart;
    
    var tmpActTime = Date.now();
    
    if (aActivityType == nsIHttpActivityObserver.ACTIVITY_TYPE_HTTP_TRANSACTION) {
      //Log(aActivitySubtype + " :: " + aHttpChannel.URI.host + " : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
      switch(aActivitySubtype) {
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_REQUEST_HEADER:
	activeRequests.push(aHttpChannel);
        activeRequests.push(win);
        if(ctx) {
          if(!ctx.httpstart) {
            ctx.httpstart = time;
            requestTime = time;
   	    fTime = 0;
            //Log("requestTime = " + requestTime);// + " :: timestamp = " + time);
          }
          tmp.httpstart = time;
        }
        totalHTTPsend += aExtraStringData.length;
	break;
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_HEADER:
	totalHTTPrecv += aExtraStringData.length;
	var respHdr = aExtraStringData;
	// check for scripts
	var re = /\.js/ig;
	var m = tmp.url.match(re);
	if(m) {
	  tmp.contentType = "js";
	  break;
	} else {
	  re = /text\/javascript/ig;
	  m = respHdr.match(re);
	  if(m) {
	    tmp.contentType = "js";
	    break;
	  }
	}
	// check for flash
	var re = /\.swf/ig;
	var m = tmp.url.match(re);
	if(m) {
	  tmp.contentType = "flash";
	  break;
	} else {
	  re = new RegExp("application/x-shockwave-flash");
	  m = respHdr.match(re);
	  if(m) {
	    tmp.contentType = "flash";
	    break;
	  }
	}
	// check for images
	var re = /\.jpg|\.jif|\.png|\.jpeg/ig;
	var m = tmp.url.match(re);
	if(m) {
	  tmp.contentType = "img";
	  break;
	} else {
	  re = /image\/gif|image\/jpg|image\/jpeg|image\/png/ig;
	  m = respHdr.match(re);
	  if(m) {
	    tmp.contentType = "img";
	    break;
	  }
	}
	break;
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_REQUEST_BODY_SENT:
	// this is always 0, why ?
	totalHTTPsend += aExtraStringData.length;
	break;
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_START:
	if(tmp)
	  tmp.rrt = (time - tmp.httpstart);
	break;
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_COMPLETE:
	if(tmp)
	  tmp.size = aExtraSizeData;
	totalHTTPrecv += tmp.size;
	break;
      case nsIHttpActivityObserver.ACTIVITY_SUBTYPE_TRANSACTION_CLOSE:
	var index = activeRequests.indexOf(aHttpChannel);
	activeRequests.splice(index, 2);
	if(tmp) {
	  tmp.httpstop = time;
	  ctx.httpstop = time;
	  // print the stat
	  /*Log("Resource " + tmp.url + " took \n\tDNS = " + (tmp.dnsstop - tmp.dnsstart) +
	    " ms\n\tConnect = " + (tmp.connectstop - tmp.connectstart) +
	    " ms\n\tSend = " + (tmp.sendstop - tmp.sendstart) +
	    " ms\n\tWait = " + (tmp.waitstop - tmp.waitstart) +
	    " ms\n\tReceive = " + (tmp.httpstop - tmp.waitstop) +
	    " ms\n\tTotal = " + (tmp.httpstop - tmp.httpstart) +
	    " ms for " + tmp.size + " bytes at an RRT of " + tmp.rrt + "\n" +
	    "Total sent = " + totalHTTPsend + "\nTotal Recv = " + totalHTTPrecv + "\n\n");*/
	}
	//utils.storeHistory(ctx);
	break;
      default:
	break;
      }
    } else if (aActivityType == nsIHttpActivityObserver.ACTIVITY_TYPE_SOCKET_TRANSPORT) {
      switch (aActivitySubtype) {
      case nsISocketTransport.STATUS_RESOLVING:
	//Log(aHttpChannel.URI.host + " :: RESOLVING : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.dnsstart = time;
	  tmp.dnsstop = time;
	}
	break;
      case nsISocketTransport.STATUS_RESOLVED:
	//Log(aHttpChannel.URI.host + " :: RESOLVED : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.dnsstop = time;
	  tmp.dnsFlag = true;
	}
	break;
      case nsISocketTransport.STATUS_CONNECTING_TO:
	//Log(aHttpChannel.URI.host + " :: CONNECTING : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.dnsFlag = true;
	  tmp.connectstart = time;
	  tmp.connectstop = time;
	}
	break;
      case nsISocketTransport.STATUS_CONNECTED_TO:
	//Log(aHttpChannel.URI.host + " :: CONNECTED : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.connectstop = time;
	  tmp.dnsFlag = true;
	  tmp.connectFlag = true;
	}
	break;
      case nsISocketTransport.STATUS_SENDING_TO:
	//Log(aTimestamp + " :: " + aHttpChannel.URI.host + " :: SENDING : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.dnsFlag = true;
	  tmp.connectFlag = true;
	  tmp.sendstart = time;
	  tmp.sendstop = time;
	  tmp.waitstart = time;
	  tmp.waitstop = time;
	}
	break;
      case nsISocketTransport.STATUS_WAITING_FOR:
	//Log(aHttpChannel.URI.host + " :: WAITING : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp) {
	  tmp.sendstop = time;
	  tmp.waitstart = time;
	  tmp.waitstop = time;
	}
	break;
      case nsISocketTransport.STATUS_RECEIVING_FROM:
	//Log(aTimestamp + " :: " + aHttpChannel.URI.spec + " :: RECEIVING : size = " + aExtraSizeData + " :: string = " + aExtraStringData);
	if(tmp && tmp.waitstop == tmp.waitstart)
	  tmp.waitstop = time;
	break;
      default:
	break;
      } 
    }
    ctx.fathomTime += (Date.now() - fStart);
    httpActivityTime += (Date.now() - tmpActTime);
    fTime += (Date.now() - fStart);
    //Log("2 fathom time = " + ctx.fathomTime + " :: httpActivityTime = " + httpActivityTime + " :: delta = " + (tmpActTime - fStart) + " :: ctxTime = " + ctxTime);
  }
};

var activityDistributor = Cc["@mozilla.org/network/http-activity-distributor;1"].getService(Ci.nsIHttpActivityDistributor);
activityDistributor.addObserver(httpObserver);

/*----------------------------------------------------------------------------*/

var listener = {
  observe : function(aSubject, aTopic, aData) {
    
    var fStart = Date.now();
    
    var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
    if (! utils)
      return;
    var win = utils.getWindowForRequest(aSubject);
    
    if(aTopic == "http-on-modify-request") {
      if ((aSubject.loadFlags & Components.interfaces.nsIChannel.LOAD_DOCUMENT_URI) &&
          aSubject.loadGroup && aSubject.loadGroup.groupObserver && win && 
          win == win.parent) {
        var requestURL = aSubject.URI.spec;
        var ctx = new page(Date.now(), win, requestURL);
        utils.setContextForWindow(win, ctx);
        httpActivityTime = 0;
        httpReqTime = 0;
        loadInProgress++;
       	//Log("URL = " + requestURL);// + " :: length = " + contexts.length);
	httpChannel.setRequestHeader("X-Fathom", "false", false);
      }

    } else if(aTopic == "http-on-examine-response" || aTopic == "http-on-examine-cached-response") {
      
      // uncomment this to check for incoming Fathom header
      /*try{
	var useFathom = httpChannel.getResponseHeader("X-Fathom");
	// if the header was present, check its value
	if(useFathom == "true") {
	// use fathom for passive measurement
	//Log("Server responded with Fathom header.\n");
	} else {
	// disable fathom measurement for the window
	// also remove the fathom binding from the window object
	utils.deleteContextByWindow(win);
	//Log("Server did not respond with Fathom header.\n");
	}
	} catch(e) {
	// disable fathom measurement for the window
	// also remove the fathom binding from the window object
	//Log("Server did not respond with Fathom header.\n");
	utils.deleteContextByWindow(win);
	}*/
    }
    
    var ctx = utils.getContextByWindow(win);
    if(ctx) {
      ctx.fathomTime += (Date.now() - fStart);
      httpReqTime += (Date.now() - fStart);
      //Log("3 fathom time = " + ctx.fathomTime + " :: httpReqTime = " + httpReqTime);
    }
    fTime += (Date.now() - fStart);
  },

  QueryInterface : function(aIID) {
    if (aIID.equals(Components.interfaces.nsISupports) ||
        aIID.equals(Components.interfaces.nsIObserver))
      return this;
    throw Components.results.NS_NOINTERFACE;
  }
};

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
observerService.addObserver(listener, "http-on-modify-request", false);
observerService.addObserver(listener, "http-on-examine-response", false);
//observerService.addObserver(listener, "http-on-examine-cached-response", false);

var eventHandlers = {
  onDOMContentLoaded: function(aEvent) {
    var fStart = Date.now();
    var doc = aEvent.originalTarget;
    if(doc instanceof HTMLDocument) {
      var ctx = utils.getContextForDocument(doc);
      var now = Date.now();
      if(ctx) {
	ctx.domcontentloaded = (now - ctx.httpstart);
	//Log("DOMC for " + doc.location + " at time = " + ctx.domcontentloaded + " :: timestamp = " + now);
	try {
	  // this is specific to the window being loaded
	  utils.storeHistory(ctx);
	} catch(e) {
	  throw("No space in local storage. " + e);
	}
	//Log("DOMC : Session history time = " + (Date.now() - now));
	var win = doc.defaultView;
	var local = win.localStorage;
	var id = win.setInterval(function() {
	  var x = utils.getContextByWindow(win);
	  try {
	    // this is specific to the window being loaded
	    utils.storeHistory(x);
	  } catch(e) {
	    throw("No space in local storage. " + e);
	  }
	}, SESSION_TIMER);
	ctx.fathomTime += Date.now() - fStart;
	//Log("4 fathom time = " + ctx.fathomTime);
      } else {
	var win = doc.defaultView;
	if(win == win.parent) {
	  var domcontentloaded = (now - requestTime);
	  //Log("DOMC for " + doc.location + " in time = " + domcontentloaded + " :: timestamp = " + now);
	}
	fTime += (Date.now() - fStart);
      }
    }
  },

  onPageLoad: function(aEvent) {
    //var fStart = Date.now();
    var doc = aEvent.originalTarget;
    if(doc instanceof HTMLDocument) {
      var ctx = utils.getContextForDocument(doc);
      var now = Date.now();
      if(ctx) {
	loadInProgress--;
	ctx.load = (now - ctx.httpstart);
	//ctx.fathomTime += Date.now() - fStart;
	//Log("Load for " + doc.location + " at time = " + ctx.load + " :: timestamp = " + now);
	//Log("Fathom took " + ctx.fathomTime + " ms, httpReqTime = " + httpReqTime + " ms, httpActivityTime = " + httpActivityTime + " ms.");
	//Log("ctxTime = " + ctxTime + " ms.")
	//Log("Total time for Fathom " + ctx.fathomTime);
	httpReqTime = 0;
	httpActivityTime = 0;
	var tc = utils.countDomains(ctx);
	//Log("Distinct domains = " + tc);
	ctxTime = 0;
	var scripts = {
	  count : 0,
	  size : 0
	}
	var images = {
	  count : 0,
	  size : 0
	}
	var flash = {
	  count : 0,
	  size : 0
	}
	for(var k = 0; k < ctx.resources.length; k++) {
	  var res = ctx.resources[k];
	  if(res && res.contentType == "js") {
	    scripts.count++;
	    scripts.size += res.size;
	    //Log(res.url)
	  } else if(res && res.contentType == "flash") {
	    flash.count++;
	    flash.size += res.size;
	    //Log(res.url)
	  } else if(res && res.contentType == "img") {
	    images.count++;
	    images.size += res.size;
	  }
	}
	/*Log("requests " + ctx.resources.length);
	  Log("# scripts = " + scripts.count + " :: size = " + scripts.size);
	  Log("# flash = " + flash.count + " :: size = " + flash.size);
	  Log("# images = " + images.count + " :: size = " + images.size);*/
	//Log("HTTP " + ctx.resources.length + " scripts " + scripts.count + " flash " + flash.count + " images " + images.count);
	//Log("\n##\n");
	//WriteToDisk(write);
      } else {
	var win = doc.defaultView;
	if(win == win.parent) {
	  var load = (now - requestTime);
	  //Log("Load for " + doc.location + " in time = " + load + " :: timestamp = " + now);
	  //Log("fTime = " + fTime);
	  //Log("\n##\n");
	  fTime = 0;
	  //WriteToDisk(write);
	}
      }
    }
  },

  onPageUnload: function (aEvent){
    var doc = aEvent.originalTarget;
    if(doc instanceof HTMLDocument) {
      var ctx = utils.getContextForDocument(doc);
      ctx = null;
    }
  }
};

(function() {
	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if(os == "Android") {
		let browsers = document.getElementById("browsers");
		browsers.addEventListener("DOMContentLoaded", eventHandlers.onDOMContentLoaded, true);
		browsers.addEventListener("load", eventHandlers.onPageLoad, true);
		browsers.addEventListener('pagehide', eventHandlers.onPageUnload, true);
	} else {
		window.addEventListener("load", function() {
			if(gBrowser) {
				gBrowser.addEventListener("DOMContentLoaded", eventHandlers.onDOMContentLoaded, true);
				gBrowser.addEventListener("load", eventHandlers.onPageLoad, true);
			}
    	}, false);
		window.addEventListener('pagehide', function(event){
			if (event.originalTarget instanceof HTMLDocument) {
				eventHandlers.onPageUnload(event);
			}
		}, false);
	}
})();
