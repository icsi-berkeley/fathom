(function() {

	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	function execQuery(db, query) {
		var mem = {
			memory: []
		};
		var mozIStorageStatementCallback_obj = {
			handleResult: function(aResultSet) {
				for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
					var value = row.getResultByName("json");
					var item = JSON.parse(value);
					
					var time = item.time - (new Date()).getTimezoneOffset()*60*1000;
					
					mem.memory.push([time, item.memoryUsage]);
				}
			},

			handleError: function(aError) {
				alert("Error: " + aError.message);
			},

			handleCompletion: function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
					alert("Query canceled or aborted!");
					
				plot(mem, "ffxMemory", "MB");
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
	
	var file = FileUtils.getFile("ProfD", ["baseline_browserMemory.sqlite"]);
	var db = Services.storage.openDatabase(file);
	var q1 = "SELECT * FROM browserMemory";
	execQuery(db, [q1]);
	
})();
