(function () {
	var traceroute_test = function(userFn, host) {
	  window.fathom.system.doTraceroute(userFn, host);
	};

	function progress(info) {
	
		//dump("\n\n" + JSON.stringify(info) + "\n\n");
	
		var len = info.hop.length;
		var res = "fail";
		var msg = "Not even reached the gateway.";
		var expdone = false;
		
		if(len > 0) {
			if(len == 1) {//info.hop[0].ip.trim() == Gateway) {
				msg = "Reached the gateway.";
				res = "shortcut";
			}
			if(len > 1 && info.hop[len - 1].ip && info.hop[len - 1].ip.trim() == echoServer) {
				msg = "Reached the target.";
				res = "done";
				expdone = true;
			} else if(len == 30) {
				msg = "Traceroute failed.";
				res = "fail";
				expdone = true;
			} else {
				msg = "Past the gateway.";
				res = "shortcut";
			}
		} 

		// update the tables
		globalUpdate("traceroute", info);

		//updateResults("2", traceroute.test.name, traceroute.id, res, JSON.stringify(info), msg, true, expdone);
		updateResults("2", traceroute.test.name, traceroute.id, res, tmp_traceroute.toHTML(info), msg, true, expdone);
	}

	var tmp_traceroute = {
		name: "Traceroute",
		test: function() {
			if(DNSserver)
				traceroute_test(tmp_traceroute.cbFunction, echoServer);
			else {
				traceroute.test.output = null;
				traceroute.test.cbExecuted = true;
				progress({hop: []});
			}
			return traceroute.test.checkProgress();
		},
		timeout: 50000,
		cbTimeout: 50000,
		cbFunction: function(info) {
			traceroute.test.output = info;
			traceroute.test.cbExecuted = true;
			progress(info);
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
			var obj = info.hop;
			var arr = [["Hop", "Host", "IP", "RTT1", "RTT2", "RTT3"]];
			for(var l = 0; l < obj.length; l++) {
				arr.push([obj[l].id, obj[l].host, obj[l].ip, obj[l].rtt1, obj[l].rtt2, obj[l].rtt3]);
			}
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "Traceroute successful.",
		failureMsg: "Traceroute unsuccessful.",
		shortDesc: "Traceroute to an echo server",
		longDesc: "This test performs a traceroute to an echo server (" + echoServer + ")."
	}

	var traceroute = new Node(Base.extend(tmp_traceroute));
	return traceroute;
});
