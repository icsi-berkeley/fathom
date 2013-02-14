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
			"User-Agent": "Mozilla/5.0 (X11; Linux i686; rv:13.0) Gecko/20100101 Firefox/13.0.1",
			//"Accept-Encoding": "compress, gzip"
		};
		fathom.proto.http.send(req, "GET", data, headers);
		fathom.proto.http.receive(req, recvCallback);	
	}

	var tmp_another_site_via_proxy = {
		name: "Another site via proxy",
		test: function() {
			entity(standardURL, tmp_another_site_via_proxy.cbFunction);
			return another_site_via_proxy.test.checkProgress();				
		},
		timeout: 5000,
		cbFunction: function(info) {
			another_site_via_proxy.test.output = (info && info[0] != "" && info[1] != "") ? info : null;
			var msg = "";
			if(another_site_via_proxy.test.input.length == 0)
				msg = "Proxy is unavailable.";
			else
				msg = "Proxy disallows connection to this URL.";
			if(info)
				another_site_via_proxy.test.successMsg = "Successfully connected to another site. " + msg;
			another_site_via_proxy.test.cbExecuted = true;
			// update the tables
			globalUpdate("http_common", info);
		},
		execChildren: false,
		successMsg: "",
		failureMsg: "Configured proxy does not work.",
		shortDesc: "HTTP entity retrieval for a common URL",
		longDesc: "This test tries to retrieve the HTTP entity for a standard URL in the presence of a locally configured proxy server."
	};

	var another_site_via_proxy = new Node(Base.extend(tmp_another_site_via_proxy));
	return another_site_via_proxy;
});
