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

// workers/scriptworker.js

var _requests = {};
var _nextrequestid = 1;

function _newRequest(requesttype, callback, action, args, multiresponse) {
  var requestid = _nextrequestid++;
  _requests[requestid] = {'callback' : callback};
  var obj = {requestid: requestid, action: action, args: args,
             requesttype: requesttype, multiresponse: multiresponse};
  postMessage(JSON.stringify(obj));
}

function doSocketOpenRequest(callback, action, args, multiresponse) {
  _newRequest("SOCKET_OPEN_REQUEST", callback, action, args, multiresponse);
}

function doSocketUsageRequest(callback, action, args, multiresponse) {
  _newRequest("SOCKET_USAGE_REQUEST", callback, action, args, multiresponse);
}

function doNonSocketRequest(callback, action, args, multiresponse) {
  _newRequest("NON_SOCKET_REQUEST", callback, action, args, multiresponse);
}

dataOut = function(data) {
  var obj = {action: 'dataOut', data: data};
  postMessage(JSON.stringify(obj));
};

function errorOut(data) {
  var obj = {action: 'errorOut', data: data};
  postMessage(JSON.stringify(obj));
};

var fathom = {
  broadcast : {
    openSendSocket : function(callback) {
      doSocketOpenRequest(callback, 'broadcastOpenSendSocket', []);
    },
    send : function(callback, socketid, msg, ip, port) {
      doSocketUsageRequest(callback, 'broadcastSend', [socketid, msg, ip, port]);
    },
    openReceiveSocket : function(callback, port) {
      doSocketOpenRequest(callback, 'broadcastOpenReceiveSocket', [port]);
    },
    receive : function(callback, socketid) {
      doSocketUsageRequest(callback, 'broadcastReceive', [socketid]);
    },
    closeSocket : function(callback, socketid) {
      doSocketUsageRequest(callback, 'closeSocket', [socketid]);
    }
  },
  multicast : {
    openSendSocket : function(callback, ttl) {
      doSocketOpenRequest(callback, 'multicastOpenSendSocket', [ttl]);
    },
    send : function(callback, socketid, msg, ip, port) {
      doSocketUsageRequest(callback, 'multicastSend', [socketid, msg, ip, port]);
    },
    openReceiveSocket : function(callback, ip, port) {
      doSocketOpenRequest(callback, 'multicastOpenReceiveSocket', [ip, port]);
    },
    receive : function(callback, socketid) {
      doSocketUsageRequest(callback, 'multicastReceive', [socketid]);
    },
    receiveDetails : function(callback, socketid) {
      doSocketUsageRequest(callback, 'multicastReceiveDetails', [socketid]);
    },
    closeSocket : function(callback, socketid) {
      doSocketUsageRequest(callback, 'closeSocket', [socketid]);
    }
  },
  tcp : {
    openSendSocket : function(callback, destip, destport) {
      doSocketOpenRequest(callback, 'tcpOpenSendSocket', [destip, destport]);
    },
    send : function(callback, socketid, msg) {
      doSocketUsageRequest(callback, 'tcpSend', [socketid, msg]);
    },
    openReceiveSocket : function(callback, port) {
      doSocketOpenRequest(callback, 'tcpOpenReceiveSocket', [port]);
    },
    receive : function(callback, socketid) {
      doSocketUsageRequest(callback, 'tcpReceive', [socketid]);
    },
    closeSocket : function(callback, socketid) {
      doSocketUsageRequest(callback, 'closeSocket', [socketid]);
    },
    getHostIP : function(callback, socketid) {
      doSocketUsageRequest(callback, 'tcpGetHostIP', [socketid]);
    },
    getPeerIP : function(callback, socketid) {
      doSocketUsageRequest(callback, 'tcpGetPeerIP', [socketid]);
    }
  },
  udp : {
    openSendSocket : function(callback) {
      doSocketOpenRequest(callback, 'udpOpenSendSocket', []);
    },
    send : function(callback, socketid, msg, ip, port) {
      doSocketUsageRequest(callback, 'udpSend', [socketid, msg, ip, port]);
    },
    openReceiveSocket : function(callback, port) {
      doSocketOpenRequest(callback, 'udpOpenReceiveSocket', [port]);
    },
    receive : function(callback, socketid) {
      doSocketUsageRequest(callback, 'udpReceive', [socketid]);
    },
    closeSocket : function(callback, socketid) {
      doSocketUsageRequest(callback, 'closeSocket', [socketid]);
    },
    getHostIP : function(callback, socketid) {
      doSocketUsageRequest(callback, 'udpGetHostIP', [socketid]);
    },
    getPeerIP : function(callback, socketid) {
      doSocketUsageRequest(callback, 'udpGetPeerIP', [socketid]);
    }
  },
  dns : {
    dnsOpen : function(callback, ip, port, ttl) {
      doSocketOpenRequest(callback, 'dnsOpen', [ip, port, ttl]);
    }
  },
  helper : {
  	getSystemInfo : function(callback, param) {
      doNonSocketRequest(callback, 'getSystemInfo', [param]);
    },
    getHostIP : function(callback, param, fd) {
      doNonSocketRequest(callback, 'getHostIP', [param, fd]);
    }
  },
  upnp : {
    upnpOpen : function(callback, ip, port, ttl) {
      doSocketOpenRequest(callback, 'upnpOpen', [ip, port, ttl]);
    }
  }
};

onmessage = function(event) {
  // Note: not using the 'require an "init" data property' approach here like
  // in api.js because when we put the sourcecode value as a value of an object
  // property and passed the object, we got "could not clone object" errors.
  // There's some little-documented behavior and restrictions happening for
  // data passed to workers via postMessage and various javascript object
  // security wrappers that are complicating that approach here.

  // Sanity check: make sure this isn't a ChromeWorker.
  if (typeof(ctypes) != "undefined") {
    throw 'Sanity check failed: this is a ChromeWorker, not a regular Worker.';
  }

  // Replace the onmessage handler with one that handles receiving dataIn calls
  // as well as responses to fathom api calls.
  onmessage = function(event) {
    // For data coming in, we had to convert it to a JSON string in order to
    // get around security restrictions. We generally don't have the same
    // problem sending data out of this worker, so that's why there's no JSON
    // stringification being done arguments to postMessage calls done by this
    // worker. Firefox does the converting to/from JSON for us automatically
    // when we send data out, same as it's supposed to do for sending data in
    // but there are currently too many security wrapper complexities that are
    // making that not work right now.
    // Somewhat related (though this is for ChromeWorkers):
    // https://bugzilla.mozilla.org/show_bug.cgi?id=667388
    var data = JSON.parse(event.data);
    if (typeof(data.dataIn) != "undefined") {
      self.dataIn.call(null, data.dataIn);
    } else if (data.action == "shutdown") {
      close();
      return; // probably unreachable
    } else if (data.action == "response") {
      var requestid = data.requestid;
      var result = data.result;
      var requestinfo = _requests[requestid];
      if (!requestinfo) {
        throw 'Received response for unknown requestid: ' + requestid;
      }
      try {
        requestinfo['callback'](result);
      } catch (e) {}
      delete _requests[requestid];
    }
  };

  // Replace the onerror handler with one that communicates the error back to
  // the window that executed the fathom script.
  onerror = function(event) {
    errorOut('Fathom script error: ' + event.message);
  };

  var sourcecode = event.data;
  var main = new Function(sourcecode);

  replaceCodeExecutionFunctions();

  main();
};

// We replace this onerror handler with a different one before we load the
// fathom script. This gives us some ability to differentiate between errors
// in our scriptworker code and errors in the executing fathom script.
onerror = function(event) {
  var msg = event.message + ' [' + event.filename + ':' + event.lineno + ']';
  throw 'Script worker error: ' + msg;
};

// A default dataIn function.
dataIn = function() {
  throw 'The running Fathom script did not define a dataIn function (or did ' +
        'not define it properly with "dataIn = function() {...}")';
};

function replaceCodeExecutionFunctions() {
  eval = null;
  Function = null;
  // importScripts is a function specific to Workers.
  importScripts = null;

  const origSetTimeout = setTimeout;
  setTimeout = function() {
    if (typeof(arguments[0]) != "function") {
      throw 'Security restriction: the first argument to setTimeout must be a function';
    }
    return origSetTimeout.apply(null, arguments);
  };

  const origSetInterval = setInterval;
  setInterval = function() {
    if (typeof(arguments[0]) != "function") {
      throw 'Security restriction: the first argument to setInterval must be a function';
    }
    return origSetInterval.apply(null, arguments);
  };
}
