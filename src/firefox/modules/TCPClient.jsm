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
 
const Cc = Components.classes; 
const Ci = Components.interfaces; 
 
var EXPORTED_SYMBOLS = ["TCPClient"];

function readAllFromSocket(host,port,outputData,listener)
{
  try {
    var transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
    var transport = transportService.createTransport(null,0,host,port,null);

    var outstream = transport.openOutputStream(0,0,0);
    outstream.write(outputData,outputData.length);

    var stream = transport.openInputStream(0,0,0);
    var instream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    instream.init(stream);

    var dataListener = {
      data : "",
      onStartRequest: function(request, context){},
      onStopRequest: function(request, context, status){
	instream.close();
	outstream.close();
	listener.finished(this.data);
      },
      onDataAvailable: function(request, context, inputStream, offset, count){
	this.data += instream.read(count);
      }
    };

    var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead(dataListener,null);
  } catch (ex){
    return ex;
  }
  return null;
}

var TCPClient = function(host, port, data, listener) {
  this.host = host;
  this.port = port;
  this.data = data;
  this.listener = listener;
}

TCPClient.prototype = {
  host : null,
  port : null,
  data : null,
  listener : null,
  sendAndReceive : function() {
    readAllFromSocket(this.host, this.port, this.data, this.listener);
  }
}
