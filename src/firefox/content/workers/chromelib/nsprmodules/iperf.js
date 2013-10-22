/*
 * Implementation of iperf using NSRP directly.
 *
 * The code is based on iperf 2.0.5:
 *
 * http://sourceforge.net/projects/iperf/
 *
 */

util.registerAction('iperf');
util.registerAction('iperfStop');

// TODO: the path could probably be something else?
importScripts('chrome://fathom/content/workers/chromelib/nsprmodules/long.js');

var debug = function(str) {
    dump("iperf: " + str + "\n");
};

const kKilo_to_Unit = 1024;
const kMega_to_Unit = 1024 * 1024;
const kGiga_to_Unit = 1024 * 1024 * 1024;

const kkilo_to_Unit = 1000;
const kmega_to_Unit = 1000 * 1000;
const kgiga_to_Unit = 1000 * 1000 * 1000;

const HEADER_VERSION1 = 0x80000000;
const RUN_NOW = 0x00000001;
const RUN_CLIENT = 0x00000002;

const kDefault_UDPRate = 1024 * 1024; // -u  if set, 1 Mbit/sec
const kDefault_UDPBufLen = 1470;      // -u  if set, read/write 1470 bytes

const ThreadMode = {
    kMode_Unknown : 0,
    kMode_Server : 1,
    kMode_Client : 2,
    kMode_Reporter : 3, // not used
    kMode_Listener : 4,
};

const TestMode = {
    kTest_Normal : 0,
    kTest_DualTest : 1,
    kTest_TradeOff : 2,
    kTest_ServeClient : 3, // server acts as client
    kTest_Unknown : 4,
};

// convert input string to bytes based on suffix [GMKgmk]
// i.e. 1K -> 1024 bytes, 1k -> 1000 bytes and so on
var bytestrtonum = function(str) {
    var num;
    var suffix = '0';

    var pattern = /(\d+)([A-Za-z]*)/;
    var tmp = str.match(pattern);
    num = parseInt(tmp[1]);
    suffix = tmp[2];

    /* convert according to [Gg Mm Kk] */
    switch (suffix) {
    case 'G':  num *= kGiga_to_Unit; break;
    case 'M':  num *= kMega_to_Unit; break;
    case 'K':  num *= kKilo_to_Unit; break;
    case 'g':  num *= kgiga_to_Unit; break;
    case 'm':  num *= kmega_to_Unit; break;
    case 'k':  num *= kkilo_to_Unit; break;
    default: break;
    }
    return num;
};

// convert bytes to a number based on format [GMKgmk]
var numtoformat = function(num, format) {
    var islower = (format == format.toLowerCase());
    if (islower) {
        num *= 8; // bytes -> bits
    }

    switch (format) {
    case 'G':  num *= (1.0/kGiga_to_Unit); break;
    case 'M':  num *= (1.0/kMega_to_Unit); break;
    case 'K':  num *= (1.0/kKilo_to_Unit); break;
    case 'g':  num *= (1.0/kgiga_to_Unit); break;
    case 'm':  num *= (1.0/kmega_to_Unit); break;
    case 'k':  num *= (1.0/kkilo_to_Unit); break;
    default: break;
    }
    return num;
};

// default implementation - overriden with NSPR.PR_Now below.
var gettime = function() {return (new Date()).getTime();};

var tv_sec = function(ts) {
    // ts in in milliseconds, get seconds (truncate)
    return ~~(ts/1000.0);
};

var tv_usec = function(ts) {
    // ts in milliseconds, get microseconds (truncate)
    var s = ~~(ts/1000.0); // seconds
    var us = 1000000.0*(ts/1000.0 - s); // microsec
    return ~~(us);
};

var tv_msec = function(ts) {
    // ts in milliseconds, get milliseconds (truncate)
    return Math.round(ts);
};

// corresponds to iperf struct thread_Settings
// just removed stuff we don't support (writing files for example)
//
// Initialized with iperf default settings, overriden by user args
var settings = {
    mHost : undefined,              // -c
    mLocalhost : undefined,         // -B

    // int's
    mBufLen : 128 * 1024,            // -l
    mMSS : 0,                        // -M
    mTCPWin : 0,                     // -w
    mSock : undefined,
    mTransferID : 0,

    // flags
    mBufLenSet : false,              // -l
    mNodelay : false,                // -N
//    mPrintMSS : false,               // -m
    mUDP : false,                    // -u
    mMode_Time : true,
    mSingleUDP : false,              // -U

    // enums (which should be special int's)
    mThreadMode : ThreadMode.kMode_Unknown,  // -s or -c
    mMode : TestMode.kTest_Normal,   // -r or -d

    // Hopefully int64_t's -> 53bits in javascript reality
    mUDPRate : 0,                    // -b or -u
    mAmount : 10000,                 // -n or -t

    // doubles
    mInterval : 0,                   // -i

    // shorts
    mListenPort : 0,                 // -L
    mPort : 5001,                    // -p

    // chars
//    mTTL : 1                         // -T
};

var configure = function(args) {

    if (args.client) {
	// client mode
	settings.mHost = args.client;
	settings.mThreadMode = ThreadMode.kMode_Client;

    } else if (args.server) {
	// start in listener mode
	settings.mThreadMode = ThreadMode.kMode_Listener;
	if (args.udp) {
	    settings.mUDP = true;
	    settings.mSingleUDP = true;
	    settings.mBufLen = kDefault_UDPBufLen;
	}
	if (args.multi_udp) {
	    settings.mUDP = true;
	    settings.mSingleUDP = false;
	    settings.mBufLen = kDefault_UDPBufLen;
	}
    } else {
	throw "Must define client or server!";
    }

    // common options of clients and servers

    settings.mLocalhost = args.bind || settings.mLocalhost;

    if (args.len && args.len>0) {
	settings.mBufLen = bytestrtonum(args.len);
	settings.mBufLenSet = true;
    }

    if (args.ttl && args.ttl>0) {
	settings.mTTL = args.ttl;
    }
    
    if (args.mss && args.mss>0) {
	settings.mMSS = args.mss;
    }
    
    if (args.window && args.window>0) {
	settings.mTCPWin = bytestrtonum(args.window);
    }

    if (args.interval && args.interval>0) {
	settings.mInterval = args.interval*1000.0; // ms
    }

//    if (args.print_mss) {
//	settings.mPrintMSS = true;
//    }

    if (args.nodelay) {
	settings.mNodelay = true;
    }

    if (args.port) {
	settings.mPort = args.port;
    }

    // client specific options
    if (settings.mThreadMode == ThreadMode.kMode_Client) {
	if (args.udp) {
	    settings.mUDP = true;
	    if (!settings.mBufLenSet)
		settings.mBufLen = kDefault_UDPBufLen;

	    if (args.bandwidth) {
		settings.mUDPRate = bytestrtonum(args.bandwidth);
	    } else {
		settings.mUDPRate = kDefault_UDPRate;
	    }
	}

	// duration by bytes or time
	if (args.time && args.time>0) {
	    settings.mMode_Time = true;
	    settings.mAmount = args.time * 1000.0; // ms
	} else if (args.num) {
	    settings.mMode_Time = false;
	    settings.mAmount = bytestrtonum(args.num);
	}

	// test modes
	if (args.tradeoff) {
	    settings.mMode = TestMode.kTest_TradeOff;
	} else if (args.dualtest) {
	    settings.mMode = TestMode.kTest_DualTest;
	} else if (args.serveclient) {
	    settings.mMode = TestMode.kTest_ServeClient;
	}

	if (args.listenport) {
	    settings.mListenPort = args.listenport;
	}
    }

    debug("TestMode="+settings.mMode);
    debug("ThreadMode="+settings.mThreadMode);

    settings.configured = true;
};

// udp headers:
//    int32_t id
//    u_int32_t tv_sec
//    u_int32_t tv_usec
//
var write_UDP_header = function(message, id, ts) {
    message.setInt32(0*4, id, false);
    message.setUint32(1*4, tv_sec(ts), false);
    message.setUint32(2*4, tv_usec(ts), false);
};
var read_UDP_header = function(message, obj) {
    // sec.usec -> milliseconds (double)
    var sec = message.getUint32(1*4, false);
    var usec = message.getUint32(2*4, false);
    var ts = 1000.0*sec + usec/1000.0;

    obj.packetID = message.getInt32(0*4, false);
    obj.ts = ts;
};

// client headers for bidirectional testing:
//    int32_t flags
//    int32_t numThreads
//    int32_t mPort
//    int32_t bufferlen
//    int32_t mWinBand
//    int32_t mAmount
//
var write_client_header = function(message) {
    var offset = 0; // first cli header word
    if (settings.mUDP)
	offset = 3; // comes after the packet header

    // dual test mode
    if (settings.mMode == TestMode.kTest_DualTest) {
	var a = Long.fromBits(0x00000000, HEADER_VERSION1);
	var b = Long.fromBits(0x00000000, RUN_NOW);
	message.setInt32((offset + 0)*4, a.or(b).getHighBits(), false);

    } else if (settings.mMode == TestMode.kTest_ServeClient) {
	var a = Long.fromBits(0x00000000, HEADER_VERSION1);
	var b = Long.fromBits(0x00000000, RUN_CLIENT);
	message.setInt32((offset + 0)*4, a.or(b).getHighBits(), false);

    } else if (settings.mMode == TestMode.kTest_TradeOff) {
	message.setInt32((offset + 0)*4, HEADER_VERSION1, false);	

    } else {
	message.setInt32((offset + 0)*4, 0, false);
    }

    // threads
    message.setInt32((offset + 1)*4, 1, false);

    // dual test return port
    if (settings.mListenPort != 0 ) {
	message.setInt32((offset + 2)*4, settings.mListenPort, false);
    } else {
	message.setInt32((offset + 2)*4, settings.mPort, false);
    }

    // pkt size
    if (settings.mBufLenSet) {
	message.setInt32((offset + 3)*4, settings.mBufLen, false);
    } else {
	message.setInt32((offset + 3)*4, 0, false);
    }

    // rate or window
    if (settings.mUDP) {
	message.setInt32((offset + 4)*4, settings.mUDPRate, false);
    } else {
	message.setInt32((offset + 4)*4, settings.mTCPWin, false);
    }

    // duration in sec * 100.0 or bytes
    if (settings.mMode_Time) {
	message.setInt32((offset + 5)*4, ~~(-1.0*settings.mAmount/10.0), false);
    } else {
	var a = Long.fromNumber(settings.mAmount);
	var b = Long.fromBits(0x00000000, 0x7FFFFFFF);
	message.setInt32((offset + 5)*4, a.add(b).getHighBits(), false);
    }
};
var read_client_header = function(message) {
    var offset = 3; // first cli header word

    // TODO
};

// server report header:
//    int32_t flags
//    int32_t total_len1
//    int32_t total_len2
//    int32_t stop_sec
//    int32_t stop_usec
//    int32_t error_cnt
//    int32_t outorder_cnt
//    int32_t datagrams
//    int32_t jitter1
//    int32_t jitter2
//
var write_server_header = function(report, message, ts) {
    var offset = 3; // first word

    var len = Long.fromNumber(report.totalLen);

    message.setInt32((offset+0)*4, 0x80, true); // flags
    message.setInt32((offset+1)*4, len.getHighBits(), false);
    message.setInt32((offset+2)*4, len.getLowBits(), false);
    message.setInt32((offset+3)*4, tv_sec(ts-report.startTime), false);
    message.setInt32((offset+4)*4, tv_usec(ts-report.startTime), false);
    message.setInt32((offset+5)*4, report.errorCnt, false);
    message.setInt32((offset+6)*4, report.outOfOrderCnt, false);
    message.setInt32((offset+7)*4, report.lastPacketID, false);
    message.setInt32((offset+8)*4, tv_sec(report.jitter), false); // jitter1
    message.setInt32((offset+9)*4, tv_usec(report.jitter), false); // jitter2
};

// the inverse operation
var read_server_header = function(message, obj) {
    var offset = 3; // first word

    var flags = message.getInt32((offset+0)*4, true); 
    if (flags !== 0x80)
	debug("invalid ack header flag " + flags);

    var total_len1 = message.getInt32((offset+1)*4, false);
    var total_len2 = message.getInt32((offset+2)*4, false);
    var stop_sec = message.getInt32((offset+3)*4, false);
    var stop_usec = message.getInt32((offset+4)*4, false);
    var error_cnt = message.getInt32((offset+5)*4, false);
    var outorder_cnt = message.getInt32((offset+6)*4, false);
    var datagrams = message.getInt32((offset+7)*4, false);
    var jitter1 = message.getInt32((offset+8)*4, false);
    var jitter2 = message.getInt32((offset+9)*4, false); 

    // fill result object

    obj.startTime = 0;
    obj.endTime = (stop_sec + stop_usec/1000000.0);
    obj.bytes = Long.fromBits(total_len2, total_len1).toNumber();
    obj.jitter = (jitter1 + jitter2/1000000.0)*1000.0;
    obj.errorCnt = error_cnt;
    obj.dgramCnt = datagrams;
    obj.outOfOrder = outorder_cnt;

    // %
    obj.errorRate = obj.errorCnt * 100.0 / obj.dgramCnt;

    // bytes / s
    obj.rate = obj.bytes / obj.endTime; 
    // bits / s
    obj.ratebit = (obj.bytes * 8.0) / obj.endTime ; 

    // human readable report values
    obj.ratekbit = numtoformat(obj.rate, 'k'); // kbit
    obj.rateMbit = numtoformat(obj.rate, 'm'); // Mbit
    obj.bytesK = numtoformat(obj.bytes, 'K');  // KB
    obj.bytesM = numtoformat(obj.bytes, 'M');  // MB
};

var getSocketOption = function(option) {
    if (!settings.mSock || !option) {
	return -1;
    }
    return 0;

    // FIXME: this stuff crashes firefox .... ?

    var opt = new NSPR.types.PRSocketOptionData();
    opt.option = option;
    var rv = NSPR.sockets.PR_GetSocketOption(settings.mSock, opt.address());
    if (rv < 0) {
	debug("failed to get socket option " + opt.option);
	return rv;
    }
    return opt.value;
};

var setSocketOptions = function(isClient) {
    var ret = 0;
    var setopt = function(opt) {
	var rv = NSPR.sockets.PR_SetSocketOption(settings.mSock, opt.address())	
	if (rv < 0) {
	    debug("failed to set option " + 
		  opt.option + "=" + opt.value);
	}
	return rv;
    }

    if (settings.mTCPWin > 0) {
	var opt = new NSPR.types.PRSocketOptionData();
	if (isClient) {
	    opt.option = NSPR.sockets.PR_SockOpt_SendBufferSize;
	} else {
	    opt.option = NSPR.sockets.PR_SockOpt_RecvBufferSize;
	}
	opt.value = settings.mTCPWin;	
	ret = setopt(opt);
    }
    
    if (!settings.mUDP) {
	if (settings.mMSS > 0) {
	    var opt = new NSPR.types.PRSocketOptionData();
	    opt.option = NSPR.sockets.PR_SockOpt_MaxSegment;
	    opt.value = settings.mMSS;	
	    ret = setopt(opt);
	}

	if (settings.mNodelay) {
	    var opt = new NSPR.types.PRSocketOptionData();
	    opt.option = NSPR.sockets.PR_SockOpt_NoDelay;
	    opt.value = NSPR.sockets.PR_TRUE;	
	    ret = setopt(opt);
	}
    }

    if (!isClient) {
	var opt = new NSPR.types.PRSocketOptionData();
	opt.option = NSPR.sockets.PR_SockOpt_Reuseaddr;
	opt.value = NSPR.sockets.PR_TRUE;	
	ret = setopt(opt);
    }

    return 0;
};

var reportPkt = function(report, bytes, ts) {
    report.totalLen += bytes;
    if (report.nextReportTime && report.nextReportTime>0)
	report.currLen += bytes;

    if (bytes>0) {
	report.totalDgrams += 1;
	if (report.nextReportTime && report.nextReportTime>0)
	    report.currDgrams += 1;
    }

    if (report.nextReportTime && report.nextReportTime>0 && 
	(ts >= report.nextReportTime || bytes == 0)) 
    {
	// progress report
	var obj = {
	    clientIP : report.clientIP,
	    clientPort : report.clientPort,
	    serverIP : report.serverIP,
	    serverPort : report.serverPort,
	    transferID : report.transferID,
	    timestamp : (new Date()).getTime(),
	    startTime : (report.currStartTime-report.startTime),
	    endTime : (report.nextReportTime-report.startTime),
	    bytes : report.currLen,
	    packets : report.currDgrams,
	    inprogress : true,
	    client : report.client || false,	
	    server : report.server || false,	
	    socketBufferSize : report.socketBufferSize,
	};

	// bits / s
	obj.rate = obj.bytes / ((obj.endTime - obj.startTime) / 1000.0);
	obj.ratebit = (obj.bytes * 8.0) / ((obj.endTime - obj.startTime) / 1000.0); 

	// human readable report values
	obj.rateMbit = numtoformat(obj.rate, 'm'); // Mbit
	obj.bytesK = numtoformat(obj.bytes, 'K');  // KB

	util.postResult(obj);
		
	// reset
	report.currStartTime = report.nextReportTime;
	report.nextReportTime += settings.mInterval;
	report.currLen = 0;
	report.currDgrams = 0;
    }
};

var closeReport = function(report, ts) {
    var obj = {
	clientIP : report.clientIP,
	clientPort : report.clientPort,
	serverIP : report.serverIP,
	serverPort : report.serverPort,
	transferID : report.transferID,
	timestamp : (new Date()).getTime(),
	startTime : 0,
	endTime : (ts-report.startTime),
	bytes : report.totalLen,
	packets : report.totalDgrams,
	inprogress : false,
	client : report.client || false,	
	server : report.server || false,	
	socketBufferSize : report.socketBufferSize,
    };

    // bytes / s
    obj.rate = obj.bytes / (obj.endTime / 1000.0); 
    obj.ratebit = (obj.bytes * 8.0) / (obj.endTime / 1000.0); 

    // human readable report values
    obj.ratekbit = numtoformat(obj.rate, 'k'); // kbit
    obj.rateMbit = numtoformat(obj.rate, 'm'); // Mbit
    obj.bytesK = numtoformat(obj.bytes, 'K');  // KB
    obj.bytesM = numtoformat(obj.bytes, 'M');  // MB

    util.postResult(obj);
};	    

// start in client mode
var client = function() {    
    const ACK_WAIT = 10;

    // initialize send buffer
    var inBytes = settings.mBufLen;
    var mBuf = new ArrayBuffer(settings.mBufLen, 0, settings.mBufLen);
    var message = new DataView(mBuf);
    while ( inBytes > 0 ) {
	inBytes -= 1;
	message[inBytes] =  ((inBytes % 10)+"").charCodeAt(0);
    };

    // create and connect the socket
    if (settings.mUDP) 
	settings.mSock = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);
    else
	settings.mSock = NSPR.sockets.PR_OpenTCPSocket(NSPR.sockets.PR_AF_INET);

    if (settings.mSock == null) {
	shutdown({error : "Failed to create socket : code = " + 
		  NSPR.errors.PR_GetError()});
	return;
    }
    util.registerSocket(settings.mSock);

    // server address (must know IP + port)
    var remoteaddr = new NSPR.types.PRNetAddr();
    if (NSPR.sockets.PR_StringToNetAddr(settings.mHost, remoteaddr.address())<0) {
	// TODO: add gethostname to resolve names to ip
	
	shutdown({error : "Invalid server IP : code = " + 
		  NSPR.errors.PR_GetError()});
	return;
    }

    NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, 
                               NSPR.sockets.PR_AF_INET, 
                               settings.mPort, remoteaddr.address());


    // set socket options
    setSocketOptions(true);

    if (settings.mLocalHost) {
	// bind to a given local address (IP, any port)
	var localaddr = new NSPR.types.PRNetAddr();
	if (NSPR.sockets.PR_StringToNetAddr(settings.mLocalHost, localaddr.address())<0) {
	    shutdown({error : "Invalid local IP : code = " + 
		      NSPR.errors.PR_GetError()});
	    return;
	}

	NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, 
				   NSPR.sockets.PR_AF_INET, 
				   0, localaddr.address());

	if (NSPR.sockets.PR_Bind(settings.mSock, localaddr.address()) < 0) {
	    shutdown({error: "Error binding : code = " + 
		      NSPR.errors.PR_GetError()});
	    return;
	}
    }

    // connect (use OS socket connection timeout value)
    if (NSPR.sockets.PR_Connect(settings.mSock, remoteaddr.address(),
				NSPR.sockets.PR_INTERVAL_NO_TIMEOUT) < 0) {
	shutdown({error : "Error connecting : code = " + 
		  NSPR.errors.PR_GetError()});
	return;
    }

    var local = NSPR.types.PRNetAddr();
    NSPR.sockets.PR_GetSockName(settings.mSock, local.address());
    settings.local = {};
    settings.local.ip = NSPR.util.NetAddrToString(local);
    settings.local.port = NSPR.util.PR_ntohs(local.port);
    debug("client "+settings.local.ip + ":"+settings.local.port+" proto="+(settings.mUDP ? "udp":"tcp")+"\n");

    var peer = NSPR.types.PRNetAddr();
    NSPR.sockets.PR_GetPeerName(settings.mSock, peer.address());
    settings.peer = {};
    settings.peer.ip = NSPR.util.NetAddrToString(peer);
    settings.peer.port = NSPR.util.PR_ntohs(peer.port);
    debug("connected to "+settings.peer.ip + ":"+settings.peer.port);

    // connection done - ready to start the test
    settings.mTransferID += 1;

    var delay_target = 0;
    if (settings.mUDP) {
	delay_target = settings.mBufLen * ((1000 * 8.0) / settings.mUDPRate);
    }
    var delay = 0; 
    var adjust = 0; 

    var endTime = undefined;
    var startTime = undefined;
    var init = function(ts) {
	// set timings
	startTime = ts;
	report.startTime = ts;
	report.lastPacketTime = ts;
	if (settings.mInterval>0) {
	    report.currStartTime = ts;
	    report.nextReportTime = ts + settings.mInterval;
	}
	if (settings.mMode_Time) {
	    endTime = ts + settings.mAmount;
	}

	// write info about dualtest config to the message
	write_client_header(message);
    };

    var report = {
	clientIP : settings.local.ip,
	clientPort : settings.local.port,
	serverIP : settings.peer.ip,
	serverPort : settings.peer.port,
	transferID : settings.mTransferID,
	packetID : 0,
	totalLen : 0,
	totalDgrams : 0,
	startTime : undefined,
	lastPacketTime : undefined,
	client : true,
	server : false,
    }
    if (settings.mInterval > 0) {
	// periodic reporting
	report.currLen = 0;
	report.currDgrams = 0;
    }

    report.socketBufferSize = 
	getSocketOption(NSPR.sockets.PR_SockOpt_SendBufferSize);

    var udp_fin = function(ts) {
	var retryc = ACK_WAIT;

	write_UDP_header(message, -1*report.packetID, ts);

	var recvbufsize = settings.mBufLen;
	var recvbuf = util.getBuffer(recvbufsize);

	var finloop = function() {
	    if (retryc == 0) {
		var obj = {
		    clientIP : report.clientIP,
		    clientPort : report.clientPort,
		    serverIP : report.serverIP,
		    serverPort : report.serverPort,
		    transferID : report.transferID,
		    server : true,
		    timestamp : (new Date()).getTime(),
		    noreport : true,
		    retries : ACK_WAIT,
		}
//		shutdown({error : "No server report after 10 retries"});
		shutdown(obj);
		return;
	    }

	    if (!settings.mSock || settings.mStopReq) {
		shutdown({interrupted : true});
		return;
	    }

	    retryc -= 1;

	    NSPR.sockets.PR_Send(settings.mSock, 
				 mBuf, 
				 settings.mBufLen, 
				 0, 
				 NSPR.sockets.PR_INTERVAL_NO_WAIT);

	    // block in waiting for response
	    var rv = NSPR.sockets.PR_Recv(settings.mSock, 
					  recvbuf, 
					  recvbufsize, 
					  0, 250);

	    if (rv > 0) {
		// parse report and report
		var msg = new DataView((new Uint8Array(recvbuf)).buffer);
		var obj = {
		    clientIP : report.clientIP,
		    clientPort : report.clientPort,
		    serverIP : report.serverIP,
		    serverPort : report.serverPort,
		    transferID : report.transferID,
		    server : true,
		    timestamp : (new Date()).getTime()
		}
		read_server_header(msg, obj);
		shutdown(obj);
		return;
	    } 

	    // else assume timeout and continue sending
	    setTimeout(finloop,0);

	}; // end finloop
	setTimeout(finloop,0);
    };

    // main send loop
    var loop = function() {    
	if (!settings.mSock || settings.mStopReq) {
	    shutdown({interrupted : true});
	    return;
	}

	while (true) {
	    var ts = gettime();

	    if (!startTime) {
		// first iteration
		init(ts);
	    }

	    if ((settings.mMode_Time && ts >= endTime) || 
		(!settings.mMode_Time && settings.mAmount <= 0)) {
		// done sending

		// last progress report and final report
		reportPkt(report, 0, ts);
		closeReport(report, ts);
		if (settings.mUDP) {
		    udp_fin(ts);
		} else {
		    shutdown({});
		}
		break; // from while
	    }
	
	    if (settings.mUDP) {
		// format the packet
		write_UDP_header(message, report.packetID, ts);

		// rate control
		adjust = delay_target + (report.lastPacketTime-ts);
		if ( adjust > 0  ||  delay > 0 ) {
		    delay += adjust; 
		}
	    }

	    report.packetID += 1;
	    report.lastPacketTime = ts;

	    // implicit conversion from ArrayBuffer to ctype buffer
	    var l = NSPR.sockets.PR_Send(settings.mSock, 
					 mBuf, 
					 settings.mBufLen, 
					 0, 
					 NSPR.sockets.PR_INTERVAL_NO_TIMEOUT);
	    
	    if (l<0) {
		// error writing... stop here
		reportPkt(report, 0, ts);
		closeReport(report, ts);
		if (settings.mUDP) {
		    udp_fin(ts);
		} else {
		    shutdown({});
		}
		break; // from while

	    } else {
		if (settings.mMode == TestMode.kTest_ServeClient) {
		    debug("-- switching to server mode --");
		    // first packet is sent - switch to server mode
		    if (settings.mUDP) {
			udp_single_server(function() {
			    shutdown({});
			});
		    } else {
			// reuse the current socket for receiving data
			settings.mSockIn = settings.mSock;
			tcp_single_server(function() {
			    shutdown({});
			});
		    }
		    return; // from loop
		}
		
		// accounting
		reportPkt(report, l, ts);

		if (!settings.mMode_Time) {
                    settings.mAmount -= l;
		}

		// setTimout has millisecond accuracy
		if (delay>15.0) {
		    // this will in fact be 15-20ms
		    // delay as we give the control back to
		    // the event loop
		    setTimeout(loop, tv_msec(delay));
		    break; // from while
		}
	    }
	    // continue sending inside the while loop

	} // end while
    }; // end loop

    setTimeout(loop, 0); // start with timeout to allow the return call

    return {ignore : true};
};

// start a server worker
var server = function(ts) {
    if (settings.mUDP) {
	return udp_single_server(ts);
    } else {
	return tcp_single_server(ts);
    }
}

// single threaded udp worker
var udp_single_server = function(donecb) {
    const RECV_TO = 250; // ms
    const ACK_RECV_TO = 1000; // ms
    const ACK_RETRY = 10;

    var mBuf = new ArrayBuffer(settings.mBufLen);

    var report = {
	serverIP : settings.local.ip,
	serverPort : settings.local.port,
	client : false,
	server : true,
    };
    report.socketBufferSize = 
	getSocketOption(NSPR.sockets.PR_SockOpt_RecvBufferSize);

    var reset = function(ts) {
	report.transferID = settings.mTransferID;
	report.clientIP = settings.peer.ip;
	report.clientPort = settings.peer.port;

	// set timings
	report.totalLen = 0;
	report.totalDgrams = 0;
	report.jitter = 0;
	report.errorCnt = 0;
	report.outOfOrderCnt = 0;
	report.packetID = 0;
	report.lastPacketID = 0;
 	report.startTime = ts;
	report.lastTransit = 0;

	if (settings.mInterval > 0) {
            report.currLen = 0;
            report.currDgrams = 0;
            report.currStartTime = ts;
            report.nextReportTime = ts + settings.mInterval;
	}
    };

    var udp_fin = function(cb, ts, peeraddr) {
	var retryc = ACK_RETRY;

	// assume most of the time out-of-order packets are not
	// duplicate packets, so conditionally subtract them 
	// from the lost packets.
	if (report.errorCnt > report.outOfOrderCnt) {
	    report.errorCnt -= report.outOfOrderCnt;
	}

	// last progress report and final report
	reportPkt(report, 0, ts);
	closeReport(report, ts);

	var msg = new DataView(mBuf);
	write_server_header(report, msg, ts);

	var finloop = function() {
	    if (retryc == 0 || !settings.mSock || settings.mStopReq) {
		setTimeout(cb,0);
		return;
	    }

	    retryc -= 1;
	    var l = NSPR.sockets.PR_SendTo(settings.mSock, 
					   mBuf, 
					   settings.mBufLen, 
					   0, 
					   peeraddr.address(),
					   NSPR.sockets.PR_INTERVAL_NO_TIMEOUT);

	    if (l>0) {
		var rv = NSPR.sockets.PR_RecvFrom(settings.mSock, 
						  mBuf, 
						  settings.mBufLen, 
						  0, 
						  peeraddr.address(), 
						  ACK_RECV_TO);
		if (rv <= 0) {
		    // got nothing from the client - we're done
		    setTimeout(cb,0);
		    return;
		}
	    } else {
		// errors in sending - stop trying
		debug("failed to send ack: " + NSPR.errors.PR_GetError());
		setTimeout(cb,0);
		return;
	    }
	    
	    // try sending again
	    setTimeout(finloop, 0);

	}; // end finloop

	setTimeout(finloop, 0);

    }; // end udp_fin

    var peeraddr = new NSPR.types.PRNetAddr();
    var curr_peeraddr = undefined;
    var lastreloop = undefined;

    var loop = function() {
	if (!settings.mSock || settings.mStopReq) {
	    shutdown({interrupted : true});
	    return;
	}

	lastreloop = gettime();

	// this internal while is to keep receiving data as fast
	// as possible when a test is running, outer loop is 
	// called upon timeouts (+ every now and then) to keep 
	// the worker thread responsive
	var done = false;
	while (!done) {
	    var rv = NSPR.sockets.PR_RecvFrom(settings.mSock, 
					      mBuf, 
					      settings.mBufLen, 
					      0, 
					      peeraddr.address(),
					      RECV_TO);

	    var ts = gettime();
	    if (rv > 0) {
		if (!curr_peeraddr || 
		    (peeraddr.port !== curr_peeraddr.port ||
		     peeraddr.ip !== curr_peeraddr.ip)) 
		{
		    // new client !
		    settings.peer = {};
		    settings.peer.ip = NSPR.util.NetAddrToString(peeraddr);
		    settings.peer.port = NSPR.util.PR_ntohs(peeraddr.port);
		    settings.mTransferID += 1;
		    curr_peeraddr = peeraddr;
		    reset(ts);
		    
		    debug("["+settings.mTransferID+"] UDP "+ 
			  " connection from " + settings.peer.ip + ":" + 
			  settings.peer.port);
		}

		var msg = new DataView(mBuf);
		var obj = {};
		read_UDP_header(msg, obj);

		if (obj.packetID != 0) {
		    reportPkt(report, rv, ts);
		}
		
		if (obj.packetID < 0) {
		    // this was the last packet
		    curr_peeraddr = undefined;
		    done = true; // quit while

		    if (donecb && typeof donecb === 'function') 
			// get back to listener
			udp_fin(donecb, ts, peeraddr);
		    else
			udp_fin(loop, ts, peeraddr);
		    
		} else if (obj.packetID != 0) {
		    // from RFC 1889, Real Time Protocol (RTP) 
		    // J = J + ( | D(i-1,i) | - J ) / 16 
		    var transit = ts - obj.ts;
		    var deltaTransit;
		    if (report.lastTransit != 0) {
			deltaTransit = transit - report.lastTransit;
			if (deltaTransit < 0.0) {
			    deltaTransit = -deltaTransit;
			}
			report.jitter += (deltaTransit - report.jitter)/(16.0);
		    }
		    report.lastTransit = transit;
	    
		    // packet loss occured if the datagram 
		    // numbers aren't sequential 
		    if (obj.packetID != report.lastPacketID + 1 ) {
			if (obj.packetID < report.lastPacketID + 1 ) {
			    report.outOfOrderCnt += 1;
			} else {
			    report.errorCnt += ((obj.packetID - report.lastPacketID) - 1);
			}
		    }
	    
		    // never decrease datagramID (e.g. if we 
		    // get an out-of-order packet) 
		    if (obj.packetID > report.lastPacketID ) {
			report.lastPacketID = obj.packetID;
		    }		    	    
		}
		
	    } else if (rv < 0) {
		var err = NSPR.errors.PR_GetError();
		if (err !== NSPR.errors.PR_IO_TIMEOUT_ERROR) {
		    // something wrong - stop receiving
		    if (report.totalDgrams>0) {
			reportPkt(report, 0, ts);
			closeReport(report, ts);
		    }
		    done = true; // quit while
		    shutdown({error : "Error in recvfrom: code="+err});
		} else {
		    // there was recv timeout, loop back by the event loop
		    done = true; // quit while
		    setTimeout(loop, 0);
		}
	    } else { // rv == 0
		if (report.totalDgrams>0) {
		    reportPkt(report, 0, ts);
		    closeReport(report, ts);
		}
		done = true; // quit while
		shutdown({error : "Error in recvfrom: closed"});
	    }

	    // TODO: this is a hack to keep the server worker responsive
	    // to outside events such as shutdown ... 
	    // Other option could be just kill the worker in fathom...
	    if (ts-lastreloop > 5000.0) {
		done = true; // quit while
		setTimeout(loop, 0); // this will incure 15-20ms delay
	    }
	    // else stay in the tight while loop

	} // end while
    }; // end loop

    setTimeout(loop, 0);
    return {noerror : true}; // just to signal that the server is up
}; // udp_single_server

// tcp server worker
var tcp_single_server = function(cb) {
    const RECV_TO = 250; // ms

    var mBuf = new ArrayBuffer(settings.mBufLen);
    var ts = gettime(); // TODO: report start from first byte?

    var report = {
	serverIP : settings.local.ip,
	serverPort : settings.local.port,
	client : false,
	server : true,
	transferID : settings.mTransferID,
	clientIP : settings.peer.ip,
	clientPort : settings.peer.port,

	totalLen : 0,
	totalDgrams : 0,
	jitter : 0,
	errorCnt : 0,
	outOfOrderCnt : 0,
	packetID : 0,
	lastPacketID : 0,
	startTime : ts,
	lastTransit : 0,
    };

    if (settings.mInterval > 0) {
	// periodic reporting
	report.currLen = 0;
	report.currDgrams = 0;
	report.currStartTime = ts;
	report.nextReportTime = ts + settings.mInterval;
    }

    report.socketBufferSize = 
	getSocketOption(NSPR.sockets.PR_SockOpt_RecvBufferSize);

    var lastreloop = undefined;
    var loop = function() {
	if (!settings.mSock || settings.mStopReq) {
	    shutdown({interrupted : true});
	    return;
	}

	lastreloop = gettime();

	// this internal while is to keep receiving data as fast
	// as possible when a test is running, outer loop is 
	// called upon timeouts (+ every now and then) to keep 
	// the worker thread responsive
	var done = false;
	while (!done) {
	    var rv = NSPR.sockets.PR_Recv(settings.mSockIn, 
					  mBuf, 
					  settings.mBufLen, 
					  0, 
					  RECV_TO);

	    var ts = gettime();
	    if (rv > 0) {
		reportPkt(report, rv, ts);

	    } else if (rv < 0) {
		var err = NSPR.errors.PR_GetError();
		if (err !== NSPR.errors.PR_IO_TIMEOUT_ERROR) {
		    // something wrong - stop receiving
		    if (report.totalDgrams>0) {
			reportPkt(report, 0, ts);
			closeReport(report, ts);
		    }
		    done = true; // quit while
		    if (cb && typeof cb === 'function')
			setTimeout(cb,0);		    
		} else {
		    // there was recv timeout, loop back by the event loop
		    done = true; // quit while
		    setTimeout(loop, 0);
		}
	    } else { // rv == 0
		// connection closed - final report
		reportPkt(report, 0, ts);
		closeReport(report, ts);
		done = true; // quit while
		if (cb && typeof cb === 'function')
		    setTimeout(cb,0);
	    }

	    // TODO: this is a hack to keep the server worker responsive
	    // to outside events such as shutdown ... 
	    // Other option could be just kill the worker in fathom...
	    if (ts-lastreloop > 5000.0) {
		done = true; // quit while
		setTimeout(loop, 0); // this will incure 15-20ms delay
	    }
	    // else stay in the tight while loop

	} // end while
    }; // end loop

    // start receiving
    loop();
};

// start in listener mode
var listener = function() {
    const LIST_TO = 100;

    // create listening socket
    if (settings.mUDP) 
	settings.mSock = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);
    else
	settings.mSock = NSPR.sockets.PR_OpenTCPSocket(NSPR.sockets.PR_AF_INET);

    if (settings.mSock == null) {
	shutdown({error : "Failed to create socket : code = " + 
		  NSPR.errors.PR_GetError()});
	return;
    }
    util.registerSocket(settings.mSock);  

    // set server socket options
    setSocketOptions(false);

    // set local address and port
    var localaddr = new NSPR.types.PRNetAddr();
    if (settings.mLocalHost) {
	// bind to a given local address
	if (NSPR.sockets.PR_StringToNetAddr(settings.mLocalHost, localaddr.address())<0) {
	    shutdown({error : "Invalid local IP : code = " + 
		      NSPR.errors.PR_GetError()});
	    return;
	}
	NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, 
				   NSPR.sockets.PR_AF_INET, 
				   settings.mPort, localaddr.address());
    } else {
	NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, 
				   NSPR.sockets.PR_AF_INET, 
				   settings.mPort, localaddr.address());
    }

    if (NSPR.sockets.PR_Bind(settings.mSock, localaddr.address()) < 0) {
	shutdown({error: "Error binding : code = " + 
		  NSPR.errors.PR_GetError()});
	return;
    }

    if (!settings.mUDP) {
	// original iperf has a backlog of 5 - using the same value
	if (NSPR.sockets.PR_Listen(settings.mSock, 5) < 0) {
	    shutdown({error: "Error listening : code = " + 
		      NSPR.errors.PR_GetError()});
	    return;
	}
    }

    var local = NSPR.types.PRNetAddr();
    NSPR.sockets.PR_GetSockName(settings.mSock, local.address());
    settings.local = {};
    settings.local.ip = NSPR.util.NetAddrToString(local);
    settings.local.port = NSPR.util.PR_ntohs(local.port);

    debug("server listening at "+settings.local.ip + ":"+
	  settings.local.port+" proto="+
	  (settings.mUDP ? "UDP":"TCP"));

    if (settings.mUDP && settings.mSingleUDP) {
	debug("single threaded UDP server");
	settings.mThreadMode = ThreadMode.kMode_Server;
	return udp_single_server();
    }

    // else start receiving new clients
    debug("multi-threaded listener");

    // main listener loop
    var loop = function() {
	if (!settings.mSock || settings.mStopReq) {
	    shutdown({interrupted : true});
	    return;
	}

	if (settings.mUDP) {
	    // wait for new connection
	    var peeraddr = new NSPR.types.PRNetAddr();
	    var mBuf = new ArrayBuffer(settings.mBufLen);
	    var rv = NSPR.sockets.PR_RecvFrom(settings.mSock, 
					      mBuf, 
					      settings.mBufLen, 
					      0, 
					      peeraddr.address(), 
					      LIST_TO);

	    var ts = gettime();
	    if (rv > 0) {
		// new client !
		settings.peer = {};
		settings.peer.ip = NSPR.util.NetAddrToString(peeraddr);
		settings.peer.port = NSPR.util.PR_ntohs(peeraddr.port);		
		settings.mTransferID += 1;

		debug("["+settings.mTransferID+"] UDP "+ 
		      " connection from " + settings.peer.ip + ":" + 
		      settings.peer.port);

		// connect to the peer so we can use recv/send directly
		if (NSPR.sockets.PR_Connect(
		    settings.mSock, 
		    peeraddr.address(),
		    NSPR.sockets.PR_INTERVAL_NO_TIMEOUT) < 0) 
		{
		    shutdown({error: "Error connecting : code = " + 
			      NSPR.errors.PR_GetError()});
		    return;
		}
		
		// TODO: implement multi-threading
		debug("UDP processing incoming test in the listener worker!");

		// handle the client
		udp_single_server(function() {
		    // continue receiving clients, pass through the main event
		    // loop in case somebody wants to shut us down...
		    setTimeout(loop, 0);
		});

	    } else if (rv < 0) {
		var err = NSPR.errors.PR_GetError();
		if (err !== NSPR.errors.PR_IO_TIMEOUT_ERROR) {
		    shutdown({error: "Error recvfrom : code="+err });
		    return;
		}
	    } else {
		shutdown({error: "Error recvfrom : conn closed"});	 
		return;
	    }
	} else {
	    // wait for new connection
	    var peeraddr = new NSPR.types.PRNetAddr();
	    var socketIn = NSPR.sockets.PR_Accept(settings.mSock, 
						  peeraddr.address(), 
						  LIST_TO);

	    if (!socketIn.isNull()) {
		// new client !
		settings.peer = {};
		settings.peer.ip = NSPR.util.NetAddrToString(peeraddr);
		settings.peer.port = NSPR.util.PR_ntohs(peeraddr.port);		
		settings.mTransferID += 1;

		debug("["+settings.mTransferID+"] TCP "+ 
		      " connection from " + settings.peer.ip + ":" + 
		      settings.peer.port);

		// TODO: implement multi-threading
		debug("TCP processing incoming test in the listener worker!");

		// handle the client
		settings.mSockIn = socketIn;
		tcp_single_server(function() {
		    NSPR.sockets.PR_Close(settings.mSockIn);
		    settings.mSockIn = undefined;

		    // continue receiving clients, pass through the main event
		    // loop in case somebody wants to shut us down...
		    setTimeout(loop, 0);
		});

	    } else {
		var err = NSPR.errors.PR_GetError();
		if (err !== NSPR.errors.PR_IO_TIMEOUT_ERROR) {
		    shutdown({error: "Error accept : code="+err });
		    return;
		}

		// continue receiving clients, pass through the main event
		// loop in case somebody wants to shut us down...
		setTimeout(loop, 0);
	    }
	}
    }; // end loop

    setTimeout(loop, 0);
    return {noerror : true}; // just to signal that the server is up
};

// cleanup and terminate this worker
var shutdown = function(r) {
    if (settings.mSock) {
	util.unregisterSocket();
	NSPR.sockets.PR_Close(settings.mSock);
    }    
    settings.mSock = undefined;
    if (settings.mSockIn) {
	NSPR.sockets.PR_Close(settings.mSockIn);
    }
    settings.mSockIn = undefined;

    // post final results and indicate to fathom we're done
    var r = r || {};
    r.done = true; // flag multiresponse done
    r.closed = true; // flag for cleanup inside fathom
    util.postResult(r);
    setTimeout(close, 1); // terminates the worker
};

/* Exported method: stop running the iperf worker. */
function iperfStop() {
    settings.mStopReq = true;
    return {ignore : true};
};

/* Exported method: start iperf client, listener or server worker. */
function iperf(args) {
    // NSPR is only available now, re-declare the timestamp func
    gettime = function() { return NSPR.util.PR_Now()/1000.0; };

    // parse configuration
    if (!args.configured) {
	try {	
	    configure(args);
	} catch (err) {	
	    shutdown({error : err});	
	}
    } else {
	// we're spawning a new worker where args is the cloned
	// settings of the parent worker
	settings = args;
	if (settings.mThreadMode == ThreadMode.kMode_Listener) {
	    settings.mThreadMode = ThreadMode.kMode_Server;
	}
    }

    switch (settings.mThreadMode) {
    case ThreadMode.kMode_Listener:
	return listener();
	break;
    case ThreadMode.kMode_Server:
	return server();
	break;
    case ThreadMode.kMode_Client:	
	return client();
	break;
    default:	
	shutdown({error : "Unknown thread mode"});
    }
};
