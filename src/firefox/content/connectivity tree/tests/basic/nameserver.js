(function() {
	var nameserver_test = function(userFn) {
		window.fathom.system.getNameservers(userFn);
	};

	var tmp_nameserver = {
		name: "Nameserver",
		test: function() {
			nameserver_test(tmp_nameserver.cbFunction);
			return nameserver.test.checkProgress();
		},
		timeout: 50,
		cbFunction: function(info) {
			if(info && !info.list)
				return;
			nameserver.test.output = info.list.length ? info : null;
			if(!nameserver.test.output)
				nameserver.test.execChildren = false;
			for(var i = 0; i < info.list.length; i++) {
				DNSserver = info.list[i];
				break;
			}
			nameserver.test.cbExecuted = true;
			//log(0, nameserver.test, "DNS Server == " + DNSserver);
			log(0, nameserver.test, tmp_nameserver.toHTML(info));
			// update the tables
			globalUpdate("nameservers", info);
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
			var arr = [["Domain", "List of available nameservers"]];
			var tempArr = [];
			for(var l in obj)
				tempArr.push(obj[l]);
			arr.push(tempArr);
			return createTable(arr, arr.length, arr[0].length);
		},
		execChildren: true,
		successMsg: "Host resolver found.",
		failureMsg: "Host resolver not found.",
		shortDesc: "DNS resolver configuration",
		longDesc: "This test detects if the host has configured DNS resolvers."
	}

	var nameserver = new Node(Base.extend(tmp_nameserver));
	return nameserver;
});
