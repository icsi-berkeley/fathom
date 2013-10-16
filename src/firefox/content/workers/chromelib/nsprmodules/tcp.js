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

util.registerAction('tcpOpenSendSocket');
util.registerAction('tcpSend');
util.registerAction('tcpOpenReceiveSocket');
util.registerAction('tcpAcceptstart');
util.registerAction('tcpAcceptstop');
util.registerAction('tcpReceive');
util.registerAction('tcpGetHostIP');
util.registerAction('tcpGetPeerIP');

function tcpOpenSendSocket(ip, port) {
  var fd = NSPR.sockets.PR_OpenTCPSocket(NSPR.sockets.PR_AF_INET);

  var timeout = 1000;
  
  var addr = new NSPR.types.PRNetAddr();
  addr.ip = NSPR.util.StringToNetAddr(ip);
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, NSPR.sockets.PR_AF_INET, port, addr.address());

  if(NSPR.sockets.PR_Connect(fd, addr.address(), timeout) < 0)
    return {error : "Error connecting : code = " + NSPR.errors.PR_GetError()};

  util.registerSocket(fd);
  return {};
}

function tcpOpenReceiveSocket(port) {
  var fd = NSPR.sockets.PR_OpenTCPSocket(NSPR.sockets.PR_AF_INET);

  // Allow binding unless unless the port is actively being listened on.
  var opt = new NSPR.types.PRSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_Reuseaddr;
  opt.value = NSPR.sockets.PR_TRUE;
  NSPR.sockets.PR_SetSocketOption(fd, opt.address());
  
  var addr = new NSPR.types.PRNetAddr();
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, NSPR.sockets.PR_AF_INET, port, addr.address());

  if (NSPR.sockets.PR_Bind(fd, addr.address()) != 0) {
    return {error: "Error binding : code = " + NSPR.errors.PR_GetError()};
  }

  if (NSPR.sockets.PR_Listen(fd, 1) != 0) {
    return {error: "Error listening : code = " + NSPR.errors.PR_GetError()};
  }

  util.registerSocket(fd);
  return {};
}

/**
 * @param socketid
 * @param msg The bytes to send represented as an array of integers between 0
 *     and 255. Any value of msg will be run through ctypes.ImplicitConvert().
 *     Thus, msg can be a string but the result of the conversion may not be
 *     what you expect.
 * @param ip
 * @param port
 */
function tcpSend(socketid, msg) {
  var fd = util.getRegisteredSocket(socketid);

  var sendBuf = newBufferFromString(msg);
  NSPR.sockets.PR_Send(fd, sendBuf, msg.length, 0, 250);
}

function tcpAcceptstart(socketid) {
  util.data.multiresponse_running = true;
  setTimeout(tcpAcceptstart_helper, 0, socketid);
  return {ignore: true};  
}

function tcpAcceptstart_helper(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  var addr = new NSPR.types.PRNetAddr();
  // TODO: use a global const
  var timeout = 100;

  var fdin = NSPR.sockets.PR_Accept(fd, addr.address(), timeout);
  if (!fdin.isNull()) {
    var port = NSPR.util.PR_ntohs(addr.port);
    var ip = NSPR.util.NetAddrToString(addr);
    var result = {incoming: true, address: ip, port: port};
    
    // close accept socket - user must re-create a new
    // listener worker if he wants to accept more connections
    //
    // TODO: this is a bit ugly solution but seems to be the
    // only way as could not find a way to pass a socket
    // descriptor from a worker to another.... 
    util.unregisterSocket();
    NSPR.sockets.PR_Close(fd); 

    // register incoming socket for this worker
    util.registerSocket(fdin);

    // notify the user that we have a new connection
    util.postResult(result);
  }

  if (util.data.multiresponse_stop) {
    util.data.multiresponse_running = false;
    util.data.multiresponse_stop = false;

    // Including "done : true" in the result indicates to fathom.js that this
    // multiresponse request is finished and can be cleaned up.
    var result = {done: true};
    util.postResult(result);
    return;
  }

  // Rather than use a loop, we schedule this same function to be called again.
  // This enables calls to tcpAcceptstop (and potentially other functions) to
  // be processed.
  if (fdin.isNull()) {
    // assume timeout - continue listening
    setTimeout(tcpAcceptstart_helper, 0, socketid);
  }
  // else wait for the user for new actions on the accepted connection
  return;
}

function tcpAcceptstop(socketid) {
  if (!util.data.multiresponse_running) {
    return {error: 'No multiresponse function is running (nothing to stop).'};
  }
  util.data.multiresponse_stop = true;
  return {};
}

/**
 * @returns The bytes received as an array of integers between 0 and 255.
 */
function tcpReceive(socketid, asstring) {
  var fd = util.getRegisteredSocket(socketid);

  // Practical limit for IPv4 TCP packet data length is 65,507 bytes.
  // (65,535 - 8 byte TCP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = newBuffer(bufsize);
  var timeout = 250;

  var rv = NSPR.sockets.PR_Recv(fd, recvbuf, bufsize, 0, timeout);
  if (rv == -1) {
    // Failure. We should check the reason but for now we assume it was a timeout.
    return {error: rv};
  } else if (rv == 0) {
    return {error: 'Network connection is closed'};
  }

  var out = undefined;
  if (asstring) {
    // make sure the string terminates at correct place as buffer reused
    recvbuf[rv] = 0; 
    out = recvbuf.readString();
  } else {
  var bytesreceived = rv;
  out = [];
  for (var i = 0; i < bytesreceived; i++) {
    out.push(recvbuf[i]);
  }
  }
  return out;
}

function tcpGetHostIP(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  var selfAddr = NSPR.types.PRNetAddr();
  NSPR.sockets.PR_GetSockName(fd, selfAddr.address());
  return NSPR.util.NetAddrToString(selfAddr) + ":" + NSPR.util.PR_ntohs(selfAddr.port);
}

function tcpGetPeerIP(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  var peerAddr = NSPR.types.PRNetAddr();
  NSPR.sockets.PR_GetPeerName(fd, peerAddr.address());
  return NSPR.util.NetAddrToString(peerAddr) + ":" + NSPR.util.PR_ntohs(peerAddr.port);
}
