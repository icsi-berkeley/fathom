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

util.registerAction('udpOpen');
//util.registerAction('udpSocketIPv6');
util.registerAction('udpBind');
util.registerAction('udpConnect');
util.registerAction('udpSend');
util.registerAction('udpRecv');
util.registerAction('udpSendrecv');
util.registerAction('udpRecvstart');
util.registerAction('udpRecvstop');
util.registerAction('udpSendto');
util.registerAction('udpRecvfrom');
util.registerAction('udpRecvfromstart');
util.registerAction('udpRecvfromstop');
//util.registerAction('udpSelect');
//util.registerAction('udpPoll');
//util.registerAction('udpGetsockopt');
util.registerAction('udpSetsockopt');
util.registerAction('udpGetHostIP');
util.registerAction('udpGetPeerIP');

function udpOpen() {
  var fd = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);
  util.registerSocket(fd);
  return {};
}

function udpBind(socketid, addr, port) {
  var fd = util.getRegisteredSocket(socketid);

  var netaddr = new NSPR.types.PRNetAddr();
  if (addr == 0) {
    addr = NSPR.sockets.PR_IpAddrAny;
  } else {
    // TODO: implement
    throw 'Not implemented: binding to a specific address. Use addr value of 0 for now.'
  }
  //port = NSPR.util.PR_htons(port);
  NSPR.sockets.PR_SetNetAddr(addr, NSPR.sockets.PR_AF_INET, port, netaddr.address());

  if(NSPR.sockets.PR_Bind(fd, netaddr.address()) != 0) {
    return {error: "Error binding : code = " + NSPR.errors.PR_GetError()};
  }
  return {};
}

function udpConnect(socketid, addr, port) {
  var fd = util.getRegisteredSocket(socketid);
  var timeout = 1000;
  
  var netaddr = new NSPR.types.PRNetAddr();
  netaddr.ip = NSPR.util.StringToNetAddr(addr);
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, 
			     NSPR.sockets.PR_AF_INET, 
			     port, netaddr.address());
  
  if (NSPR.sockets.PR_Connect(fd, netaddr.address(), timeout) < 0)
    return {error : "Error connecting " + NSPR.errors.PR_GetError()};
  
  return {};
}

/**
 * @param socketid
 * @param data The bytes to send represented as an array of integers between 0
 *     and 255. Any value of msg will be run through ctypes.ImplicitConvert().
 *     Thus, msg can be a string but the result of the conversion may not be
 *     what you expect.
 */
function udpSend(socketid, data) {
  var fd = util.getRegisteredSocket(socketid);

  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;
  var sendBuf = newBufferFromString(data);
  // TODO: check retval.
  NSPR.sockets.PR_Send(fd, sendBuf, data.length, 0, timeout);

  return {};
}

/**
 * @param socketid
 * @param data The bytes to send represented as an array of integers between 0
 *     and 255. Any value of msg will be run through ctypes.ImplicitConvert().
 *     Thus, msg can be a string but the result of the conversion may not be
 *     what you expect.
 * @param ip
 * @param port
 */
function udpSendto(socketid, data, ip, port) {
  var fd = util.getRegisteredSocket(socketid);

  //port = NSPR.util.PR_htons(port);
  var addr = new NSPR.types.PRNetAddr();
  addr.ip = NSPR.util.StringToNetAddr(ip);
  // TODO: check retval;
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, NSPR.sockets.PR_AF_INET, port, addr.address());
  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;

  var sendBuf = newBufferFromString(data);
  // TODO: check retval;
  var date = Date.now();
  NSPR.sockets.PR_SendTo(fd, sendBuf, data.length, 0, addr.address(), timeout);

  return {time: date};
}

function udpRecv(socketid, length) {
  var fd = util.getRegisteredSocket(socketid);

  // Practical limit for IPv4 UDP packet data length is 65,507 bytes.
  // (65,535 - 8 byte UDP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = util.getBuffer(bufsize);
  //var addr = new NSPR.types.PRNetAddr();
  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;
  
  var rv = NSPR.sockets.PR_Recv(fd, recvbuf, bufsize, 0, timeout);
  if (rv == -1) {
    // Failure. We should check the reason but for now we assume it was a timeout.
    return {error: rv};
  } else if (rv == 0) {
    return {error: 'Network connection is closed'};
  }

  var bytesreceived = rv;
  length = length || bytesreceived;
  length = Math.min(length, bytesreceived);
  var out = [];
  for (var i = 0; i < length; i++) {
    out.push(recvbuf[i]);
  }
  return {data: out, length: bytesreceived};
}

function udpSendrecv(socketid, data, length) {
  udpSend(socketid, data);
  // XXX Once send fills in return, need to reflect here
  return udpRecv(socketid, length);
}

function udpRecvstart(socketid, length) {
  util.data.multiresponse_running = true;
  setTimeout(udpRecvstart_helper, 0, socketid, length);
  return {ignore: true};
}

function udprecvstart_helper(socketid, length) {
  var fd = util.getRegisteredSocket(socketid);
  var requestid = util.data.lastrequestid;

  // Practical limit for IPv4 UDP packet data length is 65,507 bytes.
  // (65,535 - 8 byte UDP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = util.getBuffer(bufsize);
  // TODO: use a global const
  var timeout = 100;

  var rv = NSPR.sockets.PR_Recv(fd, recvbuf, bufsize, 0, timeout);
  if (rv == -1) {
    // We assume for now the failure was a timeout.
  } else if (rv == 0) {
    util.data.multiresponse_running = false;
    util.data.multiresponse_stop = false;
    var result = {done: true, error: 'Network connection is closed'};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
    return;
  } else {
    var bytesreceived = rv;
    var curlen = length || bytesreceived;
    curlen = Math.min(curlen, bytesreceived);
    var out = [];
    for (var i = 0; i < curlen; i++) {
      out.push(recvbuf[i]);
    }
    var result = {data: out, length: bytesreceived};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
  }

  if (util.data.multiresponse_stop) {
    util.data.multiresponse_running = false;
    util.data.multiresponse_stop = false;

    // Including "done : true" in the result indicates to fathom.js that this
    // multiresponse request is finished and can be cleaned up.
    var result = {done: true};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
    return;
  }

  // Rather than use a loop, we schedule this same function to be called again.
  // This enables calls to udprecvstop (and potentially other functions) to
  // be processed.
  setTimeout(udpRecvstart_helper, 0, socketid, length);
}

function udpRecvstop(socketid) {
  if (!util.data.multiresponse_running) {
    return {error: 'No multiresponse function is running (nothing to stop).'};
  }
  util.data.multiresponse_stop = true;
}

function udpRecvfrom(socketid) {
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
  var port = NSPR.util.PR_ntohs(addr.port);
  var ip = NSPR.util.NetAddrToString(addr);
  return {data: out, address: ip, port: port};
}

function udpRecvfromstart(socketid) {
  util.data.multiresponse_running = true;
  setTimeout(udpRecvfromstart_helper, 0, socketid);
  return {ignore: true};
}

function udpRecvfromstart_helper(socketid) {
  var fd = util.getRegisteredSocket(socketid);

  var requestid = util.data.lastrequestid;

  // Practical limit for IPv4 UDP packet data length is 65,507 bytes.
  // (65,535 - 8 byte UDP header - 20 byte IP header)
  var bufsize = 65507;
  var recvbuf = newBuffer(bufsize);
  var addr = new NSPR.types.PRNetAddr();
  // TODO: use a global const
  var timeout = 100;

  var rv = NSPR.sockets.PR_RecvFrom(fd, recvbuf, bufsize, 0, addr.address(), timeout);
  var date = Date.now();
  if (rv == -1) {
    // We assume for now the failure was a timeout.
  } else if (rv == 0) {
    util.data.multiresponse_running = false;
    util.data.multiresponse_stop = false;
    var result = {done: true, error: 'Network connection is closed'};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
    return;
  } else {
    var bytesreceived = rv;
    var out = [];
    for (var i = 0; i < bytesreceived; i++) {
      out.push(recvbuf[i]);
    }
    var port = NSPR.util.PR_ntohs(addr.port);
    var ip = NSPR.util.NetAddrToString(addr);
    var result = {data: out, address: ip, port: port, time: date};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
  }

  if (util.data.multiresponse_stop) {
    util.data.multiresponse_running = false;
    util.data.multiresponse_stop = false;

    // Including "done : true" in the result indicates to fathom.js that this
    // multiresponse request is finished and can be cleaned up.
    var result = {done: true};
    var obj = {requestid: requestid, result: result};
    postMessage(JSON.stringify(obj));
    return;
  }

  // Rather than use a loop, we schedule this same function to be called again.
  // This enables calls to udprecvstop (and potentially other functions) to
  // be processed.
  setTimeout(udpRecvfromstart_helper, 0, socketid);
}

function udpRecvfromstop(socketid) {
  if (!util.data.multiresponse_running) {
    return {error: 'No multiresponse function is running (nothing to stop).'};
  }
  util.data.multiresponse_stop = true;
}

function udpSetsockopt(socketid, name, value) {
  var fd = util.getRegisteredSocket(socketid);

  var opt = new NSPR.types.PRSocketOptionData();

  if (name == "reuseaddr") {
    // Allows binding unless unless the port is actively being listened on.
    opt.option = NSPR.sockets.PR_SockOpt_Reuseaddr;
    opt.value = value ? NSPR.sockets.PR_TRUE : NSPR.sockets.PR_FALSE;
  } else {
    return {error: "Unknown socket option name: " + name};
  }

  // TODO: check retval and return {error:XXX} if failed.
  var rv = NSPR.sockets.PR_SetSocketOption(fd, opt.address());
  return {};
}

function udpGetHostIP(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  var selfAddr = NSPR.types.PRNetAddr();
  NSPR.sockets.PR_GetSockName(fd, selfAddr.address());
  return NSPR.util.NetAddrToString(selfAddr) + ":" + NSPR.util.PR_ntohs(selfAddr.port);
}

function udpGetPeerIP(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  var peerAddr = NSPR.types.PRNetAddr();
  NSPR.sockets.PR_GetPeerName(fd, peerAddr.address());
  return NSPR.util.NetAddrToString(peerAddr) + ":" + NSPR.util.PR_ntohs(peerAddr.port);
}
