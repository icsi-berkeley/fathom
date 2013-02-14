(function() {

	function getHTTPSURL(testURL) {
		var uri = new Uri(testURL);
		if(uri.scheme == "https")
			return testURL;
		return testURL.replace(/^http:\/\//i, "https://");
	}

	var tmp_https = {
		name: "HTTPS",
		test: function() {
			var https_url = getHTTPSURL(url);
			fathom.proto.http.getCertificateChain(https_url, https.test.cbFunction);
			return https.test.checkProgress();				
		},
		timeout: 50,
		cbFunction: function(info) {
			var certInfo = JSON.parse(info);
			https.test.output = (certInfo && certInfo.certs.length != 0) ? certInfo : null;
			var uri = new Uri(url);
			if(https.test.output) {
				if(uri.scheme == "http")
					https.test.successMsg = "Fix the URL scheme to be HTTPS.";
				else
					https.test.successMsg = "Fix the URL path.";
			} else {
				if(uri.scheme == "https")
					https.test.failureMsg = "Server does not support HTTPS.";
				else {
					if(!https.test.input)
						https.test.failureMsg = "Server is down.";
					else
						https.test.failureMsg = "Check proxy settings.";
				}
			}
			https.test.cbExecuted = true;
			// update the tables
			globalUpdate("https", info);
		},
		execChildren: false,
		successMsg: "",
		failureMsg: "",
		shortDesc: "HTTPS connectivity",
		longDesc: "This test tries to retrieve the certificate chain associated with an HTTPS connection to " + (new Uri(url)).host + " ."
	};

	var https = new Node(Base.extend(tmp_https));
	return https;
});
