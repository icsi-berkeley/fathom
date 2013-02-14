(function() {

	var object = {
		DEST_PORT: 53,
		domain: null,
		protocol: null,
		callback: null,
		dns: null,
		output: []
	}

	function update(res, domain) {
		var resp = JSON.parse(res);
		if(!resp || !resp.questions || resp.questions.length == 0 || !resp.questions[0].name)
			return;
		var dom = resp.questions[0].name;
		if((domain + ".") != dom)
			return;

		for(var i = 0; i < resp.answers.length; i++)
			if(resp.answers[i] && resp.answers[i].address)
				object.output.push(resp.answers[i].address);
		
		object.callback(object.output);
	}


	function recordSend(result) {
		if (result && result['error']) {
			//log('Send failed: ' + result['error']);
		} else {
			//log('Send succeeded');
		}
	}

	function recordReceive(result) {
		if (result && result['error']) {
			//log('Receive failed: ' + result['error']);
		} else {
			if(object.protocol == "udp")
				var data = result.data;
			else
				var data = result;
			//log('Received: ' + data);
			fathom.proto.dns.response(dns, data, object.domain, update);
		}
	}

	/*----------------------------------------------------------------------------*/

	function lookup_test(name, srv, proto, callback) {
		object.domain = name;
		object.protocol = proto;
		object.callback = callback;
		dns = fathom.proto.dns.create(proto);
		var data = fathom.proto.dns.query(dns, object.domain, 1, 1, 0x0100);
		fathom.proto.dns.sendRecv(dns, srv, object.DEST_PORT, data, recordSend, recordReceive);
	}

	var tmp_lookup = {
		name: "Lookup host",
		test: function() {
			//log(0, lookup.test, JSON.stringify(lookup.test.input));
			lookup_test(domainName, DNSserver, "udp", tmp_lookup.cbFunction);
			return lookup.test.checkProgress();
		},
		timeout: 500,
		cbFunction: function(info) {
			lookup.test.output = (info.length > 0) ? info : null;
			lookup.test.cbExecuted = true;			
			//log(0, lookup.test, "lookup " + domainName);
			//log(0, lookup.test, info.join("<br></br>"));
			log(0, lookup.test, tmp_lookup.toHTML([domainName, info]));
			// update the tables
			globalUpdate("lookup", info);
		},
		toHTML: function(info) {
			function createTable(data, rows, cols) {
				var num_rows = rows;
				var num_cols = cols;
				var theader = '<table id="jsonToTable">\n';
				var tbody = '';

				for(var i = 0; i < num_rows; i++) {
					tbody += '<tr>';
					for(var j = 0; j < num_cols; j++) {
						tbody += i ? '<td>' : '<th>';
						tbody += data[i][j];
						tbody += i ? '</td>' : '</th>';
					}
					tbody += '</tr>\n';
				}
				var tfooter = '</table>';
				return theader + tbody + tfooter;
			}
			var arr = [["Domain name", "List of IPs"]];
			arr.push([info[0], info[1].join("\n")]);
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "DNS tests passed.",
		failureMsg: "Lookup failed. Resolving with CD bit set.",
		shortDesc: "IP address lookup for the domain",
		longDesc: "This test tries to retrieve the 'A' record for the domain via the configured resolver."
	};

	var lookup = new Node(Base.extend(tmp_lookup));
	return lookup;
});
