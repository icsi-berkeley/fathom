(function() {

	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	function execQuery(db, query) {
		var tasks = {
			total: [],
			running: [],
			sleeping: []
		};
		var memory = {
			used: [],
			free: []
		};
		var cpu = {
			user: [],
			system: []
		};
		var mozIStorageStatementCallback_obj = {
			handleResult: function(aResultSet) {
				for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
					var value = row.getResultByName("json");
					var item = JSON.parse(value);
					
					var time = item.time - (new Date()).getTimezoneOffset()*60*1000;

					tasks.total.push([time, item.tasks.total]);
					tasks.running.push([time, item.tasks.running]);
					tasks.sleeping.push([time, item.tasks.sleeping]);

					memory.used.push([time, item.memory.used]);
					memory.free.push([time, item.memory.free]);

					cpu.user.push([time, item.cpu.user]);
					cpu.system.push([time, item.cpu.system]);
				}
			},

			handleError: function(aError) {
				alert("Error: " + aError.message);
			},

			handleCompletion: function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
					alert("Query canceled or aborted!");
					
				plot(tasks, "tasks", "");
				plot(cpu, "cpu", "%");
				plot(memory, "memory", "Bytes");
			}
		};

		try {
			var statement = [];
			for(var i = 0; i < query.length; i++) {
				var stmt = db.createStatement(query[i]);
				statement.push(stmt);
				stmt.reset();
			}
			db.executeAsync(statement, statement.length, mozIStorageStatementCallback_obj);
		} catch(e) {
			alert(e + " :: " + query[i]);
		}
	}

	var data = [];
	
	var file = FileUtils.getFile("ProfD", ["baseline_system.sqlite"]);
	var db = Services.storage.openDatabase(file);
	var q1 = "SELECT * FROM system";
	execQuery(db, [q1]);

})();
