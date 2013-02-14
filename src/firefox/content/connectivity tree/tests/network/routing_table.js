(function (){
	var routingInfo = function(userFn) {
	  window.fathom.system.getRoutingTable(userFn);
	};

	var tmp_routing_table = {
		name: "Routing table",
		test: function() {
			routingInfo(tmp_routing_table.cbFunction);
			return routing_table.test.checkProgress();
		},
		timeout: 50,
		cbFunction: function(info) {
			//dump("\n" + JSON.stringify(info) + "\n");
			routing_table.test.output = info.defaultEntry.length ? info : null;
			if(!routing_table.test.output)
				routing_table.test.execChildren = false;
			routing_table.test.cbExecuted = true;
			/*log(0, routing_table.test, "routing_table");
			log(0, routing_table.test, JSON.stringify(info));
			log(0, routing_table.test, "Gateway info");
			for(var i = 0; i < info.defaultEntry.length; i++) {
				log(0, routing_table.test, info.defaultEntry[i].gateway + ", " + info.defaultEntry[i].interface + ", " + info.defaultEntry[i].version);
				Gateway.push(info.defaultEntry[i].gateway);
			}*/
			log(0, routing_table.test, tmp_routing_table.toHTML(info.entry));
			// update the tables
			globalUpdate("routing", info);
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
			var arr = [["Destination", "Gateway", "Mask", "Interface"]];
			for(var l = 0; l < obj.destination.length; l++) {
				arr.push([obj.destination[l], obj.gateway[l], obj.mask[l], obj.interface[l]]);
			}
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "Routing table is available.",
		failureMsg: "No routing configuration is available.",
		shortDesc: "Routing table status",
		longDesc: "This test tries to determine the host's routing configuration."
	}

	var routing_table = new Node(Base.extend(tmp_routing_table));
	return routing_table;
});
