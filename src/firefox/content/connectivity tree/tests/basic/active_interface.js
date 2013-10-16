(function() {
	var interface_test = function(userFn) {
		
		function TestInterface(win, callback) {
		
			// get defaultInterfaces
			win.fathom.system.getRoutingTable(handler);

			function handler(outinfo) {

				var dIface = null;
				var ip = null;

				if(outinfo && outinfo.defaultEntry && outinfo.defaultEntry.length) {
					dIface = outinfo.defaultEntry[0].interface;
				}          

				win.fathom.system.getActiveInterfaces(cbkfn);

				function cbkfn(intfs) {
					var os = win.fathom.util.os();
					// an array of current interfaces
					if(intfs.length > 0) {
						for(var i = 0; i < intfs.length; i++) {
							if(os == "WINNT") {
								if(intfs[i].address.ipv4 == dIface) {
									dIface = intfs[i].name;
									ip = intfs[i].address.ipv4;
									break;
								}
							} else {
								if(intfs[i].name == dIface) {
									ip = intfs[i].address.ipv4;
									break;
								}
							}
						}
					}
					
					var retval = (dIface && ip) ? dIface + ", IP = " + ip : null;
					callback(retval);
					
				}
			}
		}

		/* check interface up/down */
		TestInterface(window, intfcbk);
		
		function intfcbk(intfUp) {
			dump("\nInterface == " + intfUp + "\n");
			if(!intfUp) {
				retval = window.fathom.system.getLastKnownInterface();
				if(retval) {
					log(0, interface.test, "Your default interface is disabled. The previous active interface was " + retval);
				} else { 
					log(0, interface.test, "Your default interface is disabled. Could not retrieve last good interface configuration.");
				}
			} else {
				log(0, interface.test, "Your default interface is " + intfUp + " and it is up.");
			}
			userFn(intfUp);
		}
	}

	var tmp_interface = {
		name: "Active Interface",
		test: function() {
			interface_test(tmp_interface.cbFunction);
			return interface.test.checkProgress();
		},
		timeout: 50,
		cbFunction: function(info) {
			interface.test.output = info ? info : null;
			if(!interface.test.output)
				interface.test.execChildren = false;
			interface.test.cbExecuted = true;
			//log(0, interface.test, JSON.stringify(info));
			log(0, interface.test, tmp_interface.toHTML(info));
			// update the tables
			globalUpdate("configuration", info);
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
			var obj = info ? info.split(",") : ["", "="];
			var arr = [["Interface", "IP"], [obj[0].trim(), obj[1].split("=")[1].trim()]];
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "Network connectivity is available.",
		failureMsg: "No network connectivity.",
		shortDesc: "Active network interface status",
		longDesc: "This test tries to retrieve the host's active interface configuration."
	}

	var interface = new Node(Base.extend(tmp_interface));
	return interface;
});
