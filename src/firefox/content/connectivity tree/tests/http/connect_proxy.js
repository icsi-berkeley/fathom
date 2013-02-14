(function() {

	var tmp_connect_proxy = {
		name: "Connect proxy",
		test: function() {
			var input = connect_proxy.test.input;
			var item = input ? input[input.length - 1] : null;
			var DESC_ADDR = item ? item.host : null, DESC_PORT = item ? item.port : null;
			
			function sendSocketOpened(openedsocketid) {
				if(openedsocketid && openedsocketid['error']) {
					connect_proxy.test.output = false;
					return;
				}
				fathom.socket.tcp.send(connect_proxy.test.cbFunction, openedsocketid, "Hello World.");
			}

			if(!DESC_ADDR || !DESC_PORT)
				connect_proxy.test.cbFunction({error:"Cannot connect to the proxy."});
			else
				fathom.socket.tcp.openSendSocket(sendSocketOpened, DESC_ADDR, DESC_PORT);
			return connect_proxy.test.checkProgress();				
		},
		timeout: 50,
		cbFunction: function(result) {
			if (result && result['error'])
				connect_proxy.test.output = false;
			else
				connect_proxy.test.output = true;
			connect_proxy.test.cbExecuted = true;
			// update the tables
			globalUpdate("proxy_available", result);
		},
		execChildren: false,
		successMsg: "Proxy is available for this URL.",
		failureMsg: "Proxy is unavailable for this URL.",
		shortDesc: "Local proxy availability",
		longDesc: "This test tries to establish a TCP connection to the locally configureg proxy server."
	};

	var connect_proxy = new Node(Base.extend(tmp_connect_proxy));
	return connect_proxy;
});
