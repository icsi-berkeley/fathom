(function() {
	function isAutoConfigured(tmp, callback) {
		var retval = tmp ? true : false;
		if(tmp) {
			var bytes = tmp.split(".");
			if(bytes && bytes.length == 4 &&
					bytes[0] == "169" &&
					bytes[1] == "254")
				retval = false;
		}
		callback(retval);
	}

	var tmp_auto_configuration = {
		name: "Auto Configuration",
		test: function() {
			var tmp = auto_configuration.test.input[0];
			var ip = null;
			if(tmp) {
				tmp = tmp.split("=");
				if(tmp.length == 2)
					ip = tmp[1].trim();
			} else
				ip = null;
			isAutoConfigured(ip, tmp_auto_configuration.cbFunction);
			return auto_configuration.test.checkProgress();
		},
		timeout: 50,
		cbFunction: function(info) {
			auto_configuration.test.output = info ? info : null;
			if(!auto_configuration.test.output)
				auto_configuration.test.execChildren = false;
			auto_configuration.test.cbExecuted = true;
			// update the tables
			globalUpdate("auto", info);
		},
		execChildren: true,
		successMsg: "Network interface is DHCP enabled.",
		failureMsg: "Network interface is link-local auto-configured.",
		shortDesc: "Network interface auto-configuration",
		longDesc: "This test determines if the active interfaces' addresses are auto-configured."
	};

	var auto_configuration = new Node(Base.extend(tmp_auto_configuration));
	return auto_configuration;
});
