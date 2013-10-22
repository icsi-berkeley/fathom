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

// workers/init.js

var util = {
  // Keep track of info such as open sockets so we can close them if we're told
  // to terminate.
  data : {
    //'nextsocketid : 1,
    //sockets : {},
    socketfd : null,
    buf: null,
    buflen: null,
    multiresponse_running : false,
    multiresponse_stop : false
  },

  // If an action isn't specified, it can't be called. Action names must be
  // unique and must correspond to a function by the same name in this worker's
  // "global" scope.
  actions : {},

  // Name and path to the nspr library passed in through an init message.
  nsprname : null,
  nsprpath : null,

  arch : null,
  os : null,

  registerSocket : function registerSocket(fd) {
    //var socketid = util.data.nextsocketid++;
    //util.data.sockets[socketid] = fd;
    util.data.socketfd = fd;
    //return socketid;
  },

  getRegisteredSocket : function getRegisteredSocket() {
//    if (!util.data.sockets[socketid]) {
//      throw 'No such socketid: ' + socketid;
//    }
//    return util.data.sockets[socketid];
    if (util.data.socketfd == null) {
      throw 'No registered socket.';
    }
    return util.data.socketfd;
  },

  unregisterSocket : function unregisterSocket() {
//    if (!util.data.sockets[socketid]) {
//      throw 'No such socketid: ' + socketid;
//    }
//    delete util.data.sockets[socketid];
    if (util.data.socketfd == null) {
      throw 'No registered socket.';
    }
    util.data.socketfd = null;
  },

  getBuffer : function getBuffer(len) {
    if (util.data.buf == null || util.data.buflen < len) {
      util.data.buf = newBuffer(len);
      util.data.buflen = len;
    }
    return util.data.buf;
  },

  cleanup : function cleanup() {
  	//for (var socketid in util.data.sockets)  {
    if (util.data.socketfd) {
      try {
        //closeSocket(socketid);
        closeSocket();
      } catch(e) {
      	var obj = {logmsg: "Socket close error: " + e};
        postMessage(JSON.stringify(obj));
      }
    }
  },

  getArgument : function getArgument(data, name, errormsg) {
    var value = data[name];
    if (!value) {
      if (errormsg) {
        throw 'argument error: ' + errormsg;
      } else {
        throw 'Missing required argument: ' + name;
      }
    }
    return value;
  },

  registerAction : function registerAction(actionname) {
    if (util.actions[actionname]) {
      throw 'Action already registered: ' + actionname;
    }
    util.actions[actionname] = true;
  },

  actionHandler : function actionHandler(event) {
    var data = JSON.parse(event.data);

    var actionname = util.getArgument(data, 'action');
    if (actionname == 'shutdown') {
      util.cleanup();
      close();
      return; // probably unreachable
    } else if (util.actions[actionname]) {
      var requestid = util.getArgument(data, 'requestid');
      // TODO: storing the requestid globally and relying upon it from recvstart
      // and recvfromstart results in race conditions when calling recvstop.
      util.data.lastrequestid = requestid;
      var args = util.getArgument(data, 'args');
      // Call the function in this worker's scope whose name is the same as the
      // value of actionname.
      var result = self[actionname].apply(null, args);
      // The only return values we want to ignore are objects with the key
      // "ignore" whose value is true;
      if (!result || !result['ignore']) {
        // Send the result back via postMessage().
	util.postResult(result);
      }
      return;
    }
    throw 'Unknown action: ' + actionname;
  },

  postResult : function(result) {
    var requestid = util.data.lastrequestid;
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));    
  },

  log : function log(msg) {
    var obj = JSON.stringify({logmsg: msg});
    postMessage(obj);
  }
};

onmessage = function(event) {
  var data = JSON.parse(event.data);

  util.getArgument(data, 'init', 'The worker did not receive an init message.');

  util.nsprpath = util.getArgument(data, 'nsprpath');
  // Anna: add name arg as Firefox 22 folds nspr inside other libs
  util.nsprname = (data.hasOwnProperty('nsprname') ? util.getArgument(data, 'nsprname') : "nspr4");
  util.arch = util.getArgument(data, 'arch');
  util.os = util.getArgument(data, 'os');
  importScripts('chrome://fathom/content/workers/chromelib/nspr.js');

  // Now replace the onmessage handler with the one that does the real work.
  onmessage = util.actionHandler;
};

onerror = function(event) {
  var msg = event.message + ' [' + event.filename + ':' + event.lineno + ']';
  throw 'Worker error: ' + msg;
};
