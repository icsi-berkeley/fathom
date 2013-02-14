(function() {

	function entity(url, callback) {
	
		function Lookup(uri, cbk) {
			lookup(uri, DNSServer, "udp", cbk);
		}

		var msgBody = "";
		var header = "";
		var recvCallback = function (type, data) {
			if(type == 1)
				header = data;
			else
				msgBody += data;
			if(type == 4)
				callback([header, msgBody]);
		}

		var req = fathom.proto.http.create();
		fathom.proto.http.open(req, url, Lookup, null);
		var data = null;
		var headers = {
			//"Connection": "keep-alive",
			"User-Agent": "Mozilla/5.0 (X11; Linux i686; rv:13.0) Gecko/20100101 Firefox/16.0.1",
			//"Accept-Encoding": "compress, gzip"
		};
		fathom.proto.http.send(req, "GET", data, headers);
		fathom.proto.http.receive(req, recvCallback);	
	}

	function getHTTPStatus(headers) {
		var tmp = parseInt(headers[0][0].split(" ")[1]);
		if((tmp >= 200 && tmp <= 206) || tmp == 302)
			return "2xx";
		return null;
	}

	var tmp_http = {
		name: "Entity",
		test: function() {
			entity(url, tmp_http.cbFunction);
			return http.test.checkProgress();				
		},
		timeout: 50000,
		cbFunction: function(info) {
			http.test.output = (info && info[0] != "" && info[1] != "") ? info : null;
			var respCode = "";
			if(info) {
				respCode = getHTTPStatus(info[0]);
				if(respCode == "2xx")
					http.test.successMsg = "HTTP test passed.";
				else
					http.test.successMsg = "URL/server problem.";
			}
			http.test.cbExecuted = true;
			// update the tables
			globalUpdate("http", respCode);
		},
		execChildren: true,
		successMsg: "",
		failureMsg: "Could not retrieve HTTP entity.",
		shortDesc: "HTTP entity retrival for " + url,
		longDesc: "This test tries to retrieve the HTTP entity for " + url + " ."
	};

	var http = new Node(Base.extend(tmp_http));
	return http;
});
