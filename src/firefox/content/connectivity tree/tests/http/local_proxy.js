(function() {

	var tmp_local_proxy = {
		name: "Local proxy",
		test: function() {
			var proxyInfo = fathom.system.getProxyInfo(url);
			local_proxy.test.cbFunction(proxyInfo);
			return local_proxy.test.checkProgress();				
		},
		timeout: 50,
		cbFunction: function(info) {
			local_proxy.test.output = info;
			local_proxy.test.successMsg = (info.type ? info.type : "No") + " proxy configured for URL.";
			local_proxy.test.cbExecuted = true;
			// update the tables
			globalUpdate("user_proxy", info);
		},
		execChildren: true,
		successMsg: "",
		failureMsg: "Proxy detection failed.",
		shortDesc: "User-configured proxy servers",
		longDesc: "This test tries to detect any locally configured proxy servers on the host which might affect connections to " + url + " ."
	};

	var local_proxy = new Node(Base.extend(tmp_local_proxy));
	return local_proxy;
});
