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
 
var EXPORTED_SYMBOLS = ["ServerSocket"];

const Cc = Components.classes; 
const Ci = Components.interfaces; 

const nsIServerSocket = Components.interfaces.nsIServerSocket;
const nsITransport = Components.interfaces.nsITransport;
const nsIScriptableInputStream = Components.interfaces.nsIScriptableInputStream;

var responseFunction = null;
var consumeFunction = null;

var listener = {

  consumeInput: function(input, cHost, cPort) {

    var sin = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(nsIScriptableInputStream);
    sin.init(input);
    
    var resp = "";
    do {
      resp = sin.read(512);
    } while (resp == "");
    
    while (sin.available() > 0)
    resp += sin.read(512);
    
    return consumeFunction(resp, cHost, cPort);
  },

  onSocketAccepted : function(socket, transport) {
    try {
      
      var input = transport.openInputStream(nsITransport.OPEN_BLOCKING,0,0);
      var flag = this.consumeInput(input, transport.host, transport.port);
      input.close();
      
      var stream = transport.openOutputStream(nsITransport.OPEN_BLOCKING,0,0);
      var outputString = responseFunction(flag);
      stream.write(outputString,outputString.length);
      stream.close();

    } catch(e2){
      input.close();
      stream.close();
    }
  },

  onStopListening : function(socket, status){
  }
}

var ServerSocket = function(port, rFunction, cFunction) {
  this.port = port;
  responseFunction = rFunction;
  consumeFunction = cFunction;
}

ServerSocket.prototype = {
  port : null,
  start : function() {
    var serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
    serverSocket.init(this.port, false, -1);
    serverSocket.asyncListen(listener);
  }
}
