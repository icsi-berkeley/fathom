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
    return {error : "Error connecting " + NSPR.errors.PR_GetError()};

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

/**
 * @returns The bytes received as an array of integers between 0 and 255.
 */
function tcpReceive(socketid) {
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

  var bytesreceived = rv;
  var out = [];
  for (var i = 0; i < bytesreceived; i++) {
    out.push(recvbuf[i]);
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
