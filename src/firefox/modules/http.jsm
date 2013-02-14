
function HTTP_TCP(fathom) {
	this.fathom = fathom;
}

HTTP_TCP.prototype = {

	fathom: null,
	socket: null,
	recvInterval: null,

	send : function(DESC_ADDR, DESC_PORT, DESC_DATA, recordTCPSend) {
	
		var self = this;
		
		function sendSocketOpened(openedsocketid) {
			if(openedsocketid && openedsocketid['error']) {
				// log('Error openeing TCP socket : ' + openedsocketid['error']);
				return;
			}
			var tcpsocketid = self.socket = openedsocketid;
			self.fathom.socket.tcp.send(recordTCPSend, tcpsocketid, DESC_DATA);
		}
		self.fathom.socket.tcp.openSendSocket(sendSocketOpened, DESC_ADDR, DESC_PORT);	
	},
	
	receive : function(recordTCPReceive) {

		var self = this;
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);  
		var mainWindow = wm.getMostRecentWindow("navigator:browser");

		var id = mainWindow.setInterval(function () {
	
			if(!self.socket)
				return;
				
			mainWindow.clearInterval(id);


			function receiveMsg(tcpsocketid) {
				self.fathom.socket.tcp.receive(recordTCPReceive, tcpsocketid);
			}
		
			self.recvInterval = mainWindow.setInterval(function() {
				tcpsocketid = self.socket;
				if(tcpsocketid)
					receiveMsg(tcpsocketid);
				else {
					mainWindow.clearInterval(self.recvInterval);
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

/******************************************************************************/

function Uri(url) {
    var localFlag = false;
    var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    if (!regexp.test(url)) {
        // if url is does not match the regexp, then check if it is a local file
        var local = /([\w.\/])(\w+|(\w+.\w+))/;
        if (!local.test(url)) {
            alert("return uri as null");
            return;
        }
        localFlag = true;
    }

    if (!localFlag) {
        var src = url.split(/\/+/);
        this.scheme = src[0].split(/:/)[0];
        var domainInfo = src[1].split(/:(\d+)/);
        this.host = domainInfo[0];
        this.port = domainInfo[1];
        this.localPath = "";
        if (src.length > 2) {
            for (var i = 2; i < src.length; i++)
                this.localPath += "/" + src[i];
        } else {
            this.localPath += "/";
        }
    } else if (url.match("about:blank")) {
        this.scheme = null;
        this.host = null;
        this.port = null;   // some random port??
        this.localPath = null;
    } else {
        this.scheme = "file";
        var i = url.lastIndexOf("/");
        this.host = url.substr(0, i);
        this.localPath = url.substr(i + 1, url.length - i - 1);
        this.port = -1;
    }
    if (!this.port)
        this.port = 80; // for now just default to port 80
}

Uri.prototype = {
    host: null,
    port: null,
    scheme: null,
    localPath: null
};

/******************************************************************************/

var HTTPHelpers = {

	getHeaders: function (result) {
		for(var i = 0; i < result.length - 3; i++) {
			if (result[i] == '\r'.charCodeAt(0) && 
					result[i + 1] == '\n'.charCodeAt(0) && 
					result[i + 2] == '\r'.charCodeAt(0) && 
					result[i + 3] == '\n'.charCodeAt(0)) {
		        return i;
		    }
		}
		return -1;
	},
	
	getChunks: function (buf, bodyStartPos) {
		var i = 0;
		var s = "";
		while (i < buf.length-1 && !(buf[i] == '\r'.charCodeAt(0) && buf[i+1] == '\n'.charCodeAt(0))) {
		    s += String.fromCharCode(buf[i]);
		    i++;
		}
		if (i > 0) {
		    var len = parseInt(s.trim(), 16);
		    //// log(s + " :: Length = " + len + " :: " + buf.length + " :: " + bodyStartPos + " :: " + i)
		    var content = "";
		    if(buf.length > len) {
		    	for(var t = i + 2; t < len + i + 2; t++)	//	+2 is due to \r\n
					content += String.fromCharCode(buf[t]);
		    }
		    else
		        return ["", bodyStartPos, len];
		    bodyStartPos += (i + 1) + len + 3;
		    //// log(i + " :: " + bodyStartPos + "{" + content.length + "}");
		    return [content, bodyStartPos, len] ;
		}
		else
		    return ["", bodyStartPos, len];
	},
	
	parseHeaders: function (buffer, index) {
		var s = "";
		for(var t = 0; t < index; t++)
			s += String.fromCharCode(buffer[t]);
		var headers = s.split('\n');
		var delim = ":";
		var headerinfo = [];

		for (var i = 0; i < headers.length; i++) {
		    var pos = headers[i].indexOf(delim);
		    if (pos > 0) {
		        var head = headers[i].substring(0, pos);
		        var val = headers[i].substring(pos + 2);
				headerinfo.push([head, val]);
				//// log(head)
		    } else
				headerinfo.push([headers[i].trim(), ""]);
		}
		return headerinfo;
	}
}

/******************************************************************************/

var HTTPConnection = function(uri, lookupFn, IP, fathom) {

	var self = this;
	
	function cbk(ip) {
		var endTime = (new Date()).getTime();
		// log((endTime - startTime) + " :: DNS");
		self.IP = ip;
		//// log("IP === " + ip)
		self.tcp = new HTTP_TCP(fathom);
	}
	
	IP ? cbk(IP) : lookupFn(uri, cbk);
};

HTTPConnection.prototype = {

	IP: null,
	tcp: null,
	
	send: function(data) {
		var self = this;
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);  
		var mainWindow = wm.getMostRecentWindow("navigator:browser");
		
		var id = mainWindow.setInterval(function () {
		
			if(!self.IP || !self.tcp)
				return;
				
			mainWindow.clearInterval(id);
		
			function recordSend(result) {
				if (result && result['error']) {
					// log('Send failed: ' + result['error']);
				} else {
					//// log('Send succeeded');
				}
			}
		
			self.tcp.send(self.IP, 80, data, recordSend);
			
		}, 0);
	},
	
	recv: function(size, callback) {

		var recvBuffer = [];
		var msg = null;
		var self = this;
	
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);  
		var mainWindow = wm.getMostRecentWindow("navigator:browser");
		
		var id = mainWindow.setInterval(function () {
	
			if(!self.IP || !self.tcp)
				return;
				
			mainWindow.clearInterval(id);
	
			function recordReceive(result) {
				if (result && result['error']) {
					// Ignore timeout (-1).
					if (result['error'] == -1) {
						return;
					}
					// log('TCP Receive failed: ' + result['error']);
					self.tcp.close();
				} else {
					recvBuffer = recvBuffer.concat(result);
					msg = recvBuffer;
					//// log("TCP Receive: " + result);
				}
			}
		
			self.tcp.receive(recordReceive);
			
			/**/
		
			var headers = null;
			var headerFound = -1;
			var bodyStartPos = 0;
			var content = "", transferEncoding = "", contentLength = 0, contentType = null;
			
			var id_header = mainWindow.setInterval(function() {
				if (!msg)
					return;
					
				headerFound = HTTPHelpers.getHeaders(msg);
				if(headerFound != -1) {
					mainWindow.clearInterval(id_header);
				}
			}, 0);

			var id_found = mainWindow.setInterval(function () {
				if (headerFound != -1) {
					mainWindow.clearInterval(id_found);

					headers = HTTPHelpers.parseHeaders(msg, headerFound);
					bodyStartPos = headerFound + 4;	// +4 due to \r\n\r\n
					// send the header callback
					callback(1, headers);
				
					callback(2, "");
					
					for(var i = 0; i < headers.length; i++) {
						var head = headers[i][0];
						var val = headers[i][1];
						//// log(JSON.stringify(head))
						if(head == "Transfer-Encoding")
							transferEncoding = val.trim();
						else if(head == "Content-Length")
							contentLength = parseInt(val.trim());
						else if(head == "Content-Type")
							contentType = val.split(";")[0].trim();
					}
					
				}
			}, 0);

			var id_chunks = mainWindow.setInterval(function() {
	
				if (!headers)
					return;
				
				// parse the content body
				if (transferEncoding == "chunked") {
					var buffer = null;
					if (msg.length == bodyStartPos)
						return;
					var msgPosition = bodyStartPos;
					buffer = msg.slice(bodyStartPos, msg.length);
					try {
						var tmp = HTTPHelpers.getChunks(buffer, bodyStartPos);
						content = tmp[0];
						bodyStartPos = tmp[1];
						var len = tmp[2];
					} catch (e) {
						// log("Exception " + e);
						return;
					}

					if(content != "" && contentType == "text/html" && len != 0)
						callback(3, content);

					if (content == "" && len == 0) {
						callback(4, content);
						mainWindow.clearInterval(id_chunks);
						self.tcp.close();
					}

				} else {
					if (contentLength == (msg.length - bodyStartPos)) {
						buffer = msg.slice(bodyStartPos, bodyStartPos + contentLength);
				
						for(var t = 0; t < buffer.length; t++)
							content += String.fromCharCode(buffer[t]);
							
						callback(4, content);
						mainWindow.clearInterval(id_chunks);
						self.tcp.close();
					}
				}
	
			}, 0);
			/**/
			
			
		}, 0);
	},
	
	close: function() {
		// log("closing connection")
		this.tcp.close();
	}
}

/******************************************************************************/

const HTTPResponseType = {
    HEADERS: 1,
    BYTES: 2,
    CHUNKS: 3,
    CONTENT: 4
};

function HTTPRequest(fathom) {
	this.fathom = fathom;
}

HTTPRequest.prototype = {
	fathom: null,
    url: null,
    msg: "",
    conn: null,
    callback: null,

    httpOpen: function (src, lookupFn, ip) {
        // check if it is a well-formed url
        var uri = new Uri(src);
        if (!uri.host)
            return null;
        this.url = src;
        this.conn = new HTTPConnection(uri.host, lookupFn, ip, this.fathom);
    },

    httpSend: function (method, data, headers) {
        if (!this.conn)
            return null;

        // this creates/updates headers
        var reqHeaders = this.updateHeaders(headers);

        // create an HTTP request
        var uri = new Uri(this.url);
        var request = method + " " + uri.localPath + " HTTP/1.1\r\nHost: " + uri.host + "\r\n" + reqHeaders + "\r\n" + (data ? data : "");

        return this.conn.send(request);
    },

    HTTPResponseCallback: function (type, reply) {
		
        switch (type) {
            case HTTPResponseType.HEADERS:
                break;
                
            case HTTPResponseType.BYTES:
                break;
                
            case HTTPResponseType.CHUNKS:
                this.msg += reply.trim();
                break;
                
            case HTTPResponseType.CONTENT:
                this.msg += reply.trim();
                break;
                
            default:
                break;
        }
        
        if(this.callback)
	        this.callback(type, reply);
    },

    httpRecv: function (callback) {
        if (!this.conn)
            return;
        this.callback = callback;
        this.conn.recv(this.bufferSize, this["HTTPResponseCallback"].bind(this));
    },

    httpClose: function () {
        if (this.conn)
            this.conn.close();
    },

    updateHeaders: function (headers) {
        var h = "";
        if (headers)
            for (var x in headers)
                h = h + x + ": " + headers[x] + "\r\n";
        return h;
    }
}

/******************************************************************************/

var EXPORTED_SYMBOLS = ["HTTPRequest", "HTTP_TCP", "Uri", "HTTPHelpers", "HTTPConnection", "HTTPResponseType"];

