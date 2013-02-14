function plot(obj, div, yLabel) {

	function toTitleCase(str) {
	    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	}

	var datasets = (function () {
		var tmp = {};
		for(var i in obj) {
			tmp[i] = {
				"label": toTitleCase(i),
				"data": obj[i]
			};
		}
		return tmp;
	})();

	$(function () {

		var i = 0;
		$.each(datasets, function(key, val) {
			val.color = i;
			++i;
		});
		
		var now = new Date();
		var start = new Date();
		start.setMinutes(now.getMinutes() - 30);
		var offset = now.getTimezoneOffset()*60*1000;
		
		var options = {
			series: { lines: { show: true }, points: { show: false, radius: 1 }},
			xaxis: { mode: "time" },
			/*zoom: { interactive: true },
			pan: { interactive: true },*/
			selection: { mode: "x" }
		};
	
		function plotAccordingToChoices() {
			var data = [];

			for(var key in datasets)
			    data.push(datasets[key]);

			if (data.length > 0) {
				var plot = $.plot($("#" + div), data, options);
				//plot.setSelection({ xaxis: {from: start.getTime() + offset, to: now.getTime() + offset}});
			}
		}

		plotAccordingToChoices();
	});
}

