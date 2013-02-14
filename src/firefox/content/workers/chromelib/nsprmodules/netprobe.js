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

util.registerAction('netprobe');

var np = {

  // Config parameters for probe train
  params: {
    addr: null, // Address to send to
    port: null, // Port to send to at address

    sendDelay: 0, // ms between sends, 0 == no delay
    sendDuration: 0, // For bandwidth test, blasting duration in msecs
    sendSize: 0,
    sendMax: 0, // maximum # of packets to send

    recvSize: 0,
  },

  medianRTT: null,
  sustainedPPS: null,
  sustainedRTT: null,

  sendPadding: null, // Padding string to grow message

  actualSendSize: null,
  actualRecvSize: null,
  
  sendCount: 0,
  recvCount: 0,
  recvErrCount: 0,
  serverRecvCount: 0,

  rttCount: 0,
  sustainedRttCount: 0,
  ppsCount: 0,
  
  reorderCount: 0,
  reorderIndex: -1,

  lossBurstCount: 0,
  lossBurstLength: 0,

  dupCount: 0,
  dupData: [],

  // Time tracking
  startTime: null, // Start of entire test
  sendDoneTime: null, // Done with main send/receive cycle, begin processing stragglers
  currentTime: null, // Current time updated at various points
  lastSendTime: 0, // Time we sent last datagram

  // SOCK_DGRAM socket on which we send/receive
  sock: null, 
  
  // True when the packet train consists of low-frequency "pings"
  // (not related to ICMP), false for pipe-filling bandwidth
  // blasting.
  isPing: true,
};

function netprobe(args) {
  
  np.params.addr = args.addr;
  np.params.port = parseInt(args.port);

  if ('sendDelay' in args)
    np.params.sendDelay = parseFloat(args.sendDelay);
  if ('sendDuration' in args) {
    np.params.sendDuration = parseFloat(args.sendDuration);
    np.isPing = false;
  } 
  if ('sendSize' in args)
    np.params.sendSize = parseFloat(args.sendSize);
  if ('recvSize' in args)
    np.params.recvSize = parseInt(args.recvSize);
  if ('sendMax' in args)
    np.params.sendMax = parseFloat(args.sendMax);
  
  np.sendPadding = Array(np.params.sendSize + 1).join('.');	
  np.dupData = [];

  np.sendCount = 0;
  np.recvCount = 0;

  np.sock = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);

  var netaddr = new NSPR.types.PRNetAddr();
  var timeout = 1000;

  netaddr.ip = NSPR.util.StringToNetAddr(np.params.addr);
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, 
			     NSPR.sockets.PR_AF_INET, 
			     np.params.port, netaddr.address());
  
  if (NSPR.sockets.PR_Connect(np.sock, netaddr.address(), timeout) < 0)
    return {error : "Error connecting " + NSPR.errors.PR_GetError()};

  np.startTime = (new Date()).getTime();
  setTimeout(np_send_next, 0);

  return {ignore: true};
}

function np_send_next() {
  // Next iteration in the probe train's send/receive cycle
  np.currentTime = (new Date()).getTime();
  var elapsedTestDuration = np.currentTime - np.startTime;
  var elapsedWaitDuration = np.currentTime - np.lastSendTime;

  if (np.isPing && np.sendCount >= np.params.sendMax) {
    np.sendDoneTime = np.currentTime;
    np_finish_recv();
    return;
  }

  if (!np.isPing && elapsedTestDuration >= np.params.sendDuration) {
    np.sendDoneTime = np.currentTime;
    np_finish_recv();
    return;
  }

  // Send if we don't need to wait, or have waited long enough:
  if (np.params.sendDelay == 0 || elapsedWaitDuration > np.params.sendDelay) {
    var payload = [elapsedTestDuration, np.sendCount,
		   np.params.recvSize, np.sendPadding].join(' ');
    np.actualSendSize = payload.length;
    np.lastSendTime = np.currentTime;
    np.sendCount++;
    
    var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;
    var sendBuf = newBufferFromString(payload);
    // TODO: check retval.
    NSPR.sockets.PR_Send(np.sock, sendBuf, payload.length, 0, timeout);
    np_recv_next();	
  }

  np.currentTime = (new Date()).getTime();
  elapsedWaitDuration = np.currentTime - np.lastSendTime;
  todoWaitTime = Math.max(0, np.params.sendDelay - elapsedWaitDuration);
  setTimeout(np_send_next, todoWaitTime);
}

function np_recv_next(isPostProc) {
  var bufsize = 65507;
  var recvbuf = util.getBuffer(bufsize);
  var timeout = NSPR.sockets.PR_INTERVAL_NO_WAIT;
  
  var rv = NSPR.sockets.PR_Recv(np.sock, recvbuf, bufsize, 0, 10);
  if (rv == -1) {
    // Failure. We should check the reason but for now we assume it was a timeout.
    np.recvErrCount += 1;
    return;
  } else if (rv == 0) {
    return;
  }

  var bytesreceived = rv;
  var length = Math.min(40, bytesreceived);
  var out = [];
  for (var i = 0; i < length; i++) {
    out.push(recvbuf[i]);
  }

  np_process_response({data: out, length: bytesreceived}, isPostProc);
}

function np_finish_recv() {
  np.currentTime = (new Date()).getTime();
  var elapsedTestDuration = np.currentTime - np.startTime;

  // Keep receiving for half the test interval time once sends
  // are over, or for a few seconds if we don't have an interval.
  
  if (! np.isPing && elapsedTestDuration >= np.params.sendDuration * 1.5) {
    np_finish();
    return;
  }

  if (np.isPing && np.currentTime > np.sendDoneTime + 3000) {
    np_finish();
    return;
  }
  
  np_recv_next(true);
  setTimeout(np_finish_recv, 0);
}

function np_finish() {
  var inBurst = false;
  var currentBurst = 0;

  for (var i = 2; i < np.sendCount; i++) {
    if (np.dupData[i]) {
      inBurst = false;
      continue;
    }

    if (!np.dupData[i] && !np.dupData[i-1] && !np.dupData[i-2]) {
      if (inBurst) {
	currentBurst += 1;
	if(currentBurst > np.lossBurstLength)
	  np.lossBurstLength = currentBurst;
      } else {
	inBurst = true;
	currentBurst = 3;
	np.lossBurstCount += 1;
	if (np.lossBurstLength < 3)
	  lossBurstLength = 3;
      }		
    }
  }

  np.medianRTT = np.rttCount / np.recvCount;
  np.sustainedPPS = np.ppsCount / (np.params.sendDuration / 500);
  np.sustainedRTT = np.sustainedRttCount / np.ppsCount;
  np.sock = null;
  np.dupData = null;

  postMessage(JSON.stringify({requestid: util.data.lastrequestid,
			      result: np}));
}

function np_process_response(res, isPostProc) {
  // Helper function for processing a server sponse. The isPostproc
  // flag signals whether the method is called during the main test
  // send/receive cycle (false) or in the postprocessing stage
  // (true).
  //
  np.currentTime = (new Date()).getTime();
  var elapsedTestDuration = np.currentTime - np.startTime;
  var parseData = String.fromCharCode.apply(null, res.data);
  var respParts = parseData.split(' ');

  // The server echoes the elapsed test duration we sent:
  var sentElapsedTestDuration = parseInt(respParts[0]);
  var serverRecvCount = parseInt(respParts[4]);
  var sentSendCount = parseInt(respParts[2]); // A packet ID, effectively

  // Check that the parsed values make (some) sense
  if (! (sentElapsedTestDuration >= 0) ||
      ! (serverRecvCount >= 0) ||
      ! (sentSendCount >= 0)) {
    return;
  }
  
  if (sentSendCount < np.reorderIndex)
    np.reorderCount += 1;
  np.reorderIndex = sentSendCount;
  
  if (np.dupData[sentSendCount])
    np.dupCount += 1;
  np.dupData[sentSendCount] = true;
  
  if (serverRecvCount > np.serverRecvCount)
    np.serverRecvCount = serverRecvCount;
  
  np.rttCount += elapsedTestDuration - sentElapsedTestDuration;
  np.actualRecvSize = res.length;

  // During main test, in the second half of the test time
  // window, track stats:
  if (! isPostProc && elapsedTestDuration >= np.params.sendDuration / 2) {
    np.ppsCount += 1;
    np.sustainedRttCount += elapsedTestDuration - sentElapsedTestDuration;
  }
  
  np.recvCount++;
}
