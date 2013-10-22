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

util.registerAction('multicastOpenSendSocket');
util.registerAction('multicastSend');
util.registerAction('multicastOpenReceiveSocket');
util.registerAction('multicastReceive');
util.registerAction('multicastReceiveDetails');

function multicastOpenSendSocket(ttl) {
  var fd = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);

  // Set the TTL for the send.
  var opt = new NSPR.types.PRSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_McastTimeToLive;
  opt.value = ttl;
  NSPR.sockets.PR_SetSocketOption(fd, opt.address());
  
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
function multicastSend(socketid, msg, ip, port) {
  var fd = util.getRegisteredSocket(socketid);

  var addr = new NSPR.types.PRNetAddr();
  addr.ip = NSPR.util.StringToNetAddr(ip);
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, NSPR.sockets.PR_AF_INET, port, addr.address());

  var sendBuf = newBufferFromString(msg);
  NSPR.sockets.PR_SendTo(fd, sendBuf, msg.length, 0, addr.address(), NSPR.sockets.PR_INTERVAL_NO_WAIT);
}

function multicastOpenReceiveSocket(ip, port) {
  var fd = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);

  // Allow binding unless unless the port is actively being listened on.
  var opt = new NSPR.types.PRSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_Reuseaddr;
  opt.value = NSPR.sockets.PR_TRUE;
  NSPR.sockets.PR_SetSocketOption(fd, opt.address());
  
  var addr = new NSPR.types.PRNetAddr();
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, NSPR.sockets.PR_AF_INET, port, addr.address());

  if(NSPR.sockets.PR_Bind(fd, addr.address()) != 0) {
    return {error: "Error binding : code = " + NSPR.errors.PR_GetError()};
  }

  var socketid = util.registerSocket(fd);

  function createIGMPRequest(ip) {
    var maddr = new NSPR.types.PRMcastRequest();
	
    maddr.mcaddr = new NSPR.types.PRNetAddr();
    maddr.mcaddr.ip = NSPR.util.StringToNetAddr(ip);
    NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, NSPR.sockets.PR_AF_INET, 0, maddr.mcaddr.address());
	
    maddr.setInterfaceIpAddrAny();
    //maddr.ifadder = new NSPR.types.PRNetAddr();
    //NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, NSPR.sockets.PR_AF_INET, 0, maddr.ifaddr.address());

    return maddr;
  }

  // Construct an IGMP join request structure.
  var req = createIGMPRequest(ip);

  // Send an ADD MEMBERSHIP message via setsockopt.
  opt = new NSPR.types.PRMulticastSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_AddMember;
  opt.value = req;
  if (NSPR.sockets.PR_SetMulticastSocketOption(fd, opt.address()) == NSPR.sockets.PR_FAILURE) {
    closeSocket(socketid);
    return {error: "Failed : SetSocketOption for ADD MEMBERSHIP := " +
                   NSPR.errors.PR_GetError() + " :: " + NSPR.errors.PR_GetOSError() + " :: " + opt.address()};
  }

  return {};
}

/**
 * @returns The bytes received as an array of integers between 0 and 255.
 */
function multicastReceive(socketid) {
  var fd = util.getRegisteredSocket(socketid);

  // Practical limit for IPv4 UDP packet data length is 65,507 bytes.
  // (65,535 - 8 byte UDP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = newBuffer(bufsize);
  var addr = new NSPR.types.PRNetAddr();
  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;

  var rv = NSPR.sockets.PR_RecvFrom(fd, recvbuf, bufsize, 0, addr.address(), timeout);
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

/**
 * @returns The bytes received as an array of integers between 0 and 255, and
 * the peer ip. The object returned is {text , peer}
 *
 * Anna: adding support for returning a string instead of the raw byte array.
 */
function multicastReceiveDetails(socketid, asstring) {
  var fd = util.getRegisteredSocket(socketid);

  // Practical limit for IPv4 UDP packet data length is 65,507 bytes.
  // (65,535 - 8 byte UDP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = newBuffer(bufsize);
  var addr = new NSPR.types.PRNetAddr();
  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;

  var rv = NSPR.sockets.PR_RecvFrom(fd, recvbuf, bufsize, 0, addr.address(), timeout);
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
  return {"text" : out, "peer" : {"ip" : NSPR.util.NetAddrToString(addr), "port" : addr.port}};
}
