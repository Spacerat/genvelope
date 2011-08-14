
this.Profile = function(name) {
	var date = new Date();
	var obj = {
		log: function() {
			console.log(name+ " - "+(new Date() - date)+ "milliseconds");
		},
		toString: function() {
			return name+ " - "+(new Date() - date)+ "milliseconds";
		}
	}
	console.log("---- "+ name);
	return obj;
}
