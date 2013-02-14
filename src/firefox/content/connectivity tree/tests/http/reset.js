(function() {

	var gCallback = null;

	function TCP(fathom) {
		this.fathom = fathom;
	}

	TCP.prototype = {

		fathom: null,
		socket: null,
		recvInterval: null,

		send : function(DESC_ADDR, DESC_PORT, DESC_DATA, recordTCPSend) {
	
			var self = this;
		
			function sendSocketOpened(openedsocketid) {
				if(openedsocketid && openedsocketid['error']) {
					connRST.test.output = null;
					var reason = getErrorText(openedsocketid['error']);
					if(reason) {
						connRST.test.failureMsg = "Error encountered for the TCP connection.";
						log(0, connRST.test, reason);
					}
					if(gCallback)
						gCallback();
					return;
				}
				var tcpsocketid = self.socket = openedsocketid;
				self.fathom.socket.tcp.send(recordTCPSend, tcpsocketid, DESC_DATA);
			}
			self.fathom.socket.tcp.openSendSocket(sendSocketOpened, DESC_ADDR, DESC_PORT);	
		},
	
		receive : function(recordTCPReceive) {

			var self = this;
			var id = window.setInterval(function () {
	
				if(!self.socket)
					return;
				
				window.clearInterval(id);

				function receiveMsg(tcpsocketid) {
					self.fathom.socket.tcp.receive(recordTCPReceive, tcpsocketid);
				}
		
				self.recvInterval = window.setInterval(function() {
					tcpsocketid = self.socket;
					if(tcpsocketid)
						receiveMsg(tcpsocketid);
					else {
						window.clearInterval(self.recvInterval);
					}
				}, 0);
			}, 0);
		},
	
		close : function() {
			var tcpsocketid = this.socket;
			if(!tcpsocketid)
				return;
			this.fathom.socket.tcp.closeSocket(function(){}, tcpsocketid);
			tcpsocketid = this.socket = null;
		}
	};

	var tcp = new TCP(fathom);

	function getIP(url, cbk) {
		// check if it is a well-formed url
        var uri = new Uri(url);
        if (!uri.host)
            return null;
            
        lookup(uri.host, DNSServer, "udp", cbk);
	}
	
	function getErrorText(code) {
		return code;
	}
	
	function recordSend(result) {
		if (result && result['error']) {
			connRST.test.output = null;
			var reason = getErrorText(result['error']);
			if(reason) {
				connRST.test.failureMsg = "Error encountered for the TCP connection.";
				log(0, connRST.test, reason);
			}
			tcp.close();
			if(gCallback)
				gCallback(reason);
		} else {
		}
	}
	
	function recordReceive(result) {
		if (result && result['error']) {
			// Ignore timeout (-1).
			if (result['error'] == -1) {
				return;
			}
			connRST.test.output = null;
			var reason = getErrorText(result['error']);
			if(reason) {
				connRST.test.failureMsg = "Error encountered for the TCP connection.";
				log(0, connRST.test, reason);
			}
			tcp.close();
			if(gCallback)
				gCallback(reason);
		} else {
		}
	}

	function connectionRST(uri, IP, callback) {
		// invoke the callback
		gCallback = callback;
		// make a TCP connection to IP
		var data = null;
		var headers = {
			//"Connection": "keep-alive",
			"User-Agent": "Mozilla/5.0 (X11; Linux i686; rv:13.0) Gecko/20100101 Firefox/17.0",
			//"Accept-Encoding": "compress, gzip"
		};
		var reqHeaders = "";
        if (headers)
            for (var x in headers)
                reqHeaders = reqHeaders + x + ": " + headers[x] + "\r\n";
		var request = "GET " + uri.localPath + " HTTP/1.1\r\nHost: " + uri.host + "\r\n" + reqHeaders + "\r\n" + (data ? data : "");
		// send HTTP data
		tcp.send(IP, 80, request, recordSend);
		// receive HTTP data, wait for error
		tcp.receive(recordReceive);
	}

	var tmp_connRST = {
		name: "RST",
		test: function() {
			// get an IP
			getIP(url, function(ip) {
				var uri = new Uri(url);
				connectionRST(uri, ip, connRST.test.cbFunction);
			});
			return connRST.test.checkProgress();				
		},
		timeout: 50,
		cbFunction: function(info) {
			connRST.test.output = info ? info : null;
			if(!connRST.test.output)
				connRST.test.execChildren = false;
			connRST.test.cbExecuted = true;
			// update the tables
			globalUpdate("tcp", info);
		},
		execChildren: true,
		successMsg: "No errors encountered for the TCP connection to " + (new Uri(url)).host + " .",
		failureMsg: "",
		shortDesc: "TCP connectivity to " + (new Uri(url)).host + " .",
		longDesc: "This test checks for errors in TCP connectivity to " + (new Uri(url)).host + " ."
	};

	var connRST = new Node(Base.extend(tmp_connRST));
	return connRST;
});
