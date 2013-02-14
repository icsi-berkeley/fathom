(function () {
	var activeInterfaces = function(userFn) {
		window.fathom.system.getActiveInterfaces(userFn);
	}

	var tmp_active_interface = {
		name: "Interfaces",
		test: function() {
			activeInterfaces(tmp_active_interface.cbFunction);
			return active_interface.test.checkProgress();
		},
		timeout: 50,
		cbFunction: function(info) {
			active_interface.test.output = info.length ? info : null;
			if(!active_interface.test.output)
				active_interface.test.execChildren = false;
			active_interface.test.cbExecuted = true;
			//log(0, active_interface.test, JSON.stringify(info));
			log(0, active_interface.test, tmp_active_interface.toHTML(info));
			// update the tables
			globalUpdate("interfaces", info);
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
			var obj = info;
			var arr = [["Interface", "MTU", "MAC", "TX bytes", "RX bytes"]];
			for(var k = 0; k < obj.length; k++) {
				//var tempArr = [];
				// TODO: fix this as it is not robust. it relies on the order of enumeration
				/*for(var l in obj[k])
					if(l != "address")
						tempArr.push(obj[k][l]);*/
				var tempArr = [obj[k].name, obj[k].mtu, obj[k].mac, obj[k].tx, obj[k].rx];
				arr.push(tempArr);
			}
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "Network interfaces are available.",
		failureMsg: "No network interfaces are available.",
		shortDesc: "Network interface availability",
		longDesc: "This test detects all available network interfaces on the host."
	}
	var active_interface = new Node(Base.extend(tmp_active_interface));
	return active_interface;
});
