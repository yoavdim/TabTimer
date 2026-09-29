/*
 *  TabScript.js
 *
 *  Copyright (C) 2018  Yoav Dim, All Rights Reserved.
 *
 */





		var Cycle_Interval = 1000; // !!! CONST !!! Do Not Change That !!!
		var Clock_Cycle_Interval = 1000;


		var original_time      = new Date();

		var original_clock	   = false; // true = show the time, false = act normally // TODO: from server

		var original_value     = undefined;
		var original_direction = undefined; // true = stoper = count_up ; false = count_down;
		var original_ringer    = undefined;
		var original_paused    = undefined;
		var original_am_i_extension = undefined;
		var original_am_i_search_query = undefined;

		var ring_aloud = true; // alert when time is over
		var was_alerted = false;

		var view_seconds = true; // only in the timer, log will show seconds always
		var log_with_current = false;
		var use_days = false;
		var isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent);

		window.syncLogCurrentScript = function() {
			log_with_current = document.getElementById("check-log-current").checked;
			myUpdate();
		};
		window.syncUseDaysScript = function() {
			use_days = document.getElementById("check-use-days").checked;
			myUpdate();
		};


		if( window.chrome != undefined && chrome.extension != undefined ) {
			original_value     = chrome.extension.getBackgroundPage().timeselected;
			original_direction = chrome.extension.getBackgroundPage().isStoper;
			original_ringer    = false; //TODO: from server
			original_paused    = false; //TODO: from server
			original_am_i_extension = true;
			original_am_i_search_query = false;
		} else { //not extension
			original_value     = 0;
			original_direction = true;  // count_up by default
			original_ringer    = true; //TODO: from server
			original_paused    = true; //TODO: from server
			original_am_i_extension = false;
			original_am_i_search_query = false;
			let url_pass_by = fetch_query();
			if(url_pass_by != undefined) {
				original_am_i_search_query = true;
				init_by_query(url_pass_by);
			}
		}

		function init_by_query(obj) {
			if(obj["val"] != undefined){
				if( ["stoper", "stopper", "timer", "count"].includes(obj["val"])) {
					original_value = 0;
					original_direction = true;
					original_paused = false;
					return;
				} else if(["clock", "time"].includes(obj["val"])) {
					original_value = 0;
					original_direction = true;
					original_paused = true;
					original_clock = true;
					return;
				} else {
					original_value = deformat_time(obj["val"]);
					if(original_value == undefined || original_value == NaN) {
						console.warn("warnning: the query passed value is ilegal, defaulting to zero.");
						original_value = 0;
					}
					if(obj["dir"] != undefined){
						original_direction = (obj["dir"] == "up");
					} else {
						original_direction = (original_value <= 0);
					}
					original_paused = original_direction;
				}
			}
		}
		// last set-up
		var setup_time         = original_time;
		var setup_direction    = original_direction;
		var setup_value        = original_value;

		// last flip
		var start_time         = setup_time;
		var start_direction    = setup_direction;
		var start_value        = setup_value;

		// frozed value: unfreezing or flipping will not override this
		var frozed_value	   = NaN;
		var frozed_time		   = original_time;

		// current
		var present_clock = original_clock;

		var last_time          = start_time; // aka present_time
		var present_value      = start_value;
		var present_direction  = start_direction;

		var present_ringer     = original_ringer;
		var present_paused     = original_paused;
		var present_frozen	   = false; //lighter interface than the rest

		var semi_original_time = original_time; //for full-reset
		var semi_semi_original_time = semi_original_time; // for reset

		function isterminated(){ return (! present_direction ) && ( present_ringer  ); } // The termination option for countDown is enabled.
		function isover()      { return (  isterminated() ) && ( present_value <= 0 ); } // The countDown was over.
		function ispaused()    { return  present_paused; }                               // no counting
		function isBoth()      { return (  isover() ) && (  ispaused() ); }				 //
		function isNeedTermination() { return isover() && ! ispaused(); }

		function getStatus(){   if(isactive()){return 'running...';}
								else if(isBoth()){return 'paused finished.';}
								else if(ispaused()){return 'paused.';}
								else{return 'finished!';}
		}

		function isTimeSetAllowed() {
			return ispaused();
		}


		checkboxes_sync();
		document.getElementById("z").addEventListener("click",startnew);
		document.getElementById("f").addEventListener("click",change_direction);
		document.getElementById("ag").addEventListener("click",small_reset);
		document.getElementById("res").addEventListener("click",medium_reset);
		document.getElementById("winter_res").addEventListener("click",winter_reset);
		document.getElementById("full_res").addEventListener("click",large_reset);
		document.getElementById("sw_rng").addEventListener("click",change_ringer);
		document.getElementById("frz").addEventListener("click",changeFrozen);
		document.getElementById("noise").addEventListener("click",changeRingAloud);
		document.getElementById("set-setup").addEventListener("click",try_set_up);
		document.getElementById("add-setup").addEventListener("click",try_add_up);
		document.getElementById("sub-setup").addEventListener("click",try_sub_up);
		document.getElementById("clk").addEventListener("click",change_timer_or_clock);
		document.getElementById("log-add-btn").addEventListener("click",logtime);
		document.getElementById("log-clear-btn").addEventListener("click",clearlogs);
		document.getElementById("log-pop-btn").addEventListener("click",logpop);
		document.getElementById("log-lap-btn").addEventListener("click",loglap);

		document.getElementById("log-add-btn").addEventListener("click", (e)=>{e.stopPropagation();});
		document.getElementById("log-clear-btn").addEventListener("click", (e)=>{e.stopPropagation();});
		document.getElementById("log-pop-btn").addEventListener("click", (e)=>{e.stopPropagation();});
		document.getElementById("log-lap-btn").addEventListener("click", (e)=>{e.stopPropagation();});


		//view_seconds
		document.getElementById("check-sec").addEventListener("change",sync_view_sec);
		function sync_view_sec(event){
			view_seconds = ! document.getElementById('check-sec').checked
		}
		//enter
		document.getElementById("set-box").addEventListener("keypress",onEnterPress);
		function onEnterPress(event){
			if (event.keyCode == 13) {
				try_set_up();
			}
		}
		//big one
		document.getElementById("big-button").addEventListener("click",myFlip);
		big_push_update();
		document.getElementById("big-button").focus();

		syncDirectionHint();

		//Run:
		var present_interval = false; // true if the cycle is active, !!! do not change manualy !!!
		var myVar = undefined;
		myUpdate();

		var myClockVar = undefined;
		function isClockActive() { return present_clock && ! present_frozen ; }
		function clockLoop(){
			clearTimeout(myClockVar);
			if(isClockActive()) {
				myClockVar = setTimeout(clockLoop, Clock_Cycle_Interval);
			}
			freezableGuiUpdate();
		}

		clockLoop();


		function myTimer() {
			if( ispaused() ){ myUpdate(); return; }
			subTime();
			myUpdate();
		}

		function subTime(){
			var d = new Date();
			var z = d.getTime() - last_time.getTime();
			last_time = d;
			if(present_direction){
				present_value = present_value + z;
			}else{
				present_value = present_value - z;
				if(present_ringer&& present_value<0){present_value=0;}
			}
		}

		function myUpdate(){
			terminationUpdate();
			guiUpdate();
			syncInterval();
		}
		function terminationUpdate() {
			if(isNeedTermination()) {
				pause();
				if(ring_aloud && !was_alerted) {
					beep();
				}
			} else was_alerted = false;
		}

		var beep_aud =  document.getElementById('tone');
		function beep(){
			beep_aud.play().then( ()=>{alert("Time's up!");},()=>{});
			was_alerted = true;
		}

		function changeRingAloud() {
			ring_aloud = ! document.getElementById("noise").checked;
			was_alerted = false;
		}
		function syncInterval() {
			if (present_paused) {
				if (myVar) {
					clearInterval(myVar);
					myVar = undefined;
					present_interval = false;
				}
			} else {
				if (!myVar) {
					last_time = new Date();
					myVar = setInterval(myTimer, Cycle_Interval);
					present_interval = true;
				}
			}
		}
		function guiUpdate() {
			freezableGuiUpdate();
			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.innerHTML = format_time(Number(tot.getAttribute("value")||0) + (log_with_current ? present_value : 0), true);
		}
		function checkboxes_sync(){
			document.getElementById("sw_rng").checked = present_ringer;
			document.getElementById("noise").checked = ! ring_aloud;
		}
		function big_push_update() {
			if(ispaused()){
				document.getElementById("pause-svg").setAttribute("style","display:none;");
				document.getElementById("play-svg").setAttribute("style","");
			}else{
				document.getElementById("pause-svg").setAttribute("style","");
				document.getElementById("play-svg").setAttribute("style","display:none;");
			}
		}
		function freezableGuiUpdate() {
			if( (!present_clock) && ! present_frozen ) {
				bruteForceGuiTimeUpdate(present_value);
			} else if( (!present_clock) && present_frozen) {
				bruteForceGuiTimeUpdate(frozed_value);
			} else {
				bruteForceClockGuiUpdate(present_frozen);
			}
		}
		function bruteForceGuiTimeUpdate(val) {
				document.getElementById("inner-display").innerHTML = format_time(val, view_seconds);
				if (!isBot) document.title = format_time_title(val, view_seconds);
		}
		function bruteForceClockGuiUpdate(ice = false){
			if(ice){
				var today = frozed_time;
			}else{
				var today = new Date();
			}
			var str = clock_format(today);
			document.getElementById('inner-display').innerHTML = str;
			if (!isBot) document.title = str;
		}
		function clock_format(today){
			function checkTime(i) {
				if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
					return i;
			}
			var h = today.getHours();
			var m = today.getMinutes();
			var s = today.getSeconds();
			m = checkTime(m);
			s = checkTime(s);
			if(view_seconds)
				return h + ":" + m + ":" + s;
			else
				return h + ":" + m
		}


		function changeFrozen() {
			present_frozen = ! present_frozen;
			if(present_frozen) {
				frozed_value = present_value;
				frozed_time = new Date();
				freezableGuiUpdate();
				syncFrozenHint();
			} else {
				freezableGuiUpdate();
				syncFrozenHint();
				clockLoop();
			}
		}
		function syncFrozenHint() {
			if(present_frozen) {
				document.getElementById("info-tray").setAttribute("frozen","true");
			} else {
				document.getElementById("info-tray").removeAttribute("frozen");
			}
		}


		// ----
		function change_timer_or_clock() {
			present_clock = ! present_clock;
			if(present_clock) {
				freezableGuiUpdate();
				clockLoop();
			} else {
				myUpdate();
			}
		}
		function change2time() {
			if(present_clock){
				present_clock = false;
				myUpdate();
			}
		}
		function change2clock() {
			if(!present_clock){
				present_clock = true;
				clockLoop();
			}
		}
		// ----

		function myFlip(){ // pause/play
			if(ispaused() ) resume();
			else pause();
		}

		function resume(){
			if(ispaused() && ! isover()) {
				present_paused = false;
				big_push_update();
				myUpdate();
			} else terminationUpdate();
		}
		function pause(){
			if( ! ispaused() ) {
				present_paused = true;
				subTime();
				big_push_update();
				myUpdate();
			}
		}



		function startnew(){
			do_setup(0);
		}

		function applyState(value, direction) {
			present_value = value;
			present_direction = direction;
			last_time = new Date();
		}

		function change_direction(){
			applyState(present_value, !present_direction);
			set_start_as_present();
			syncDirectionHint();
			myUpdate();
		}
		function set_start_as_present() {
			start_value = present_value;
			start_direction = present_direction;
			start_time = last_time;
		}
		function syncDirectionHint() {
			if(present_direction) {
				document.getElementById("info-tray").removeAttribute("downwards");
			} else {
				document.getElementById("info-tray").setAttribute("downwards", "true");
			}
		}

		function small_reset(){ // last flip : again
			applyState(start_value, start_direction);
			myUpdate();
		}
		function winter_reset(){ // set the value to when it was frozen
			if(!Number.isNaN(frozed_value)) {
				applyState(frozed_value, present_direction);
			} else {
				alert("no value to restore");
			}
			myUpdate();
		}

		function try_set_up() {
			try_generic_set_up(get_setup_data);
		}
		function try_add_up() {
			try_generic_set_up(get_addup_data);
		}
		function try_sub_up() {
			try_generic_set_up(get_subup_data);
		}
		function try_generic_set_up(getData) {
			if(! isTimeSetAllowed() ) {
				alert("please pause before setting up the time.");
				return;
			}
			var time = getData();
			if( time == undefined || time == NaN ) {
				alert("please enter a valid time.");
				return;
			}
			do_setup(time);
		}

		function get_setup_data() {
			return deformat_time(document.getElementById("set-box").value);
		}
		function get_addup_data() {
			return present_value + get_setup_data();
		}
		function get_subup_data() {
			return present_value - get_setup_data();
		}

		function do_setup(time) {
			setup_value = time;
			setup_direction = present_direction;
			medium_reset();
		}

		function medium_reset(){ // last set-up : reset
			start_direction    = setup_direction;
			start_value        = setup_value;
			applyState(start_value, start_direction);

			semi_semi_original_time = new Date();
			start_time = semi_semi_original_time;

			frozed_value = present_value;
			myUpdate();
		}

		function large_reset(){
			setup_direction    = original_direction;
			setup_value        = original_value;
			present_ringer     = original_ringer;
			present_paused     = original_paused;

			start_direction	   = setup_direction;
			start_value        = setup_value;
			applyState(start_value, start_direction);

			frozed_value = NaN;
			semi_original_time = new Date();
			semi_semi_original_time = semi_original_time;
			setup_time = semi_semi_original_time;
			start_time = setup_time;
			myUpdate();
		}

		function change_ringer(){
			present_ringer = document.getElementById('sw_rng').checked;
			terminationUpdate();
		}

		function fetch_query(){ // return an object that its fields are the passed key-value paits in the url
			var task = location.href;
			if(task == undefined)
				return undefined;
			var qmark = task.indexOf("?");
			if(qmark == NaN || qmark < 0 || task.length <= qmark+1)
				return undefined;
			task = task.slice(qmark + 1);
			var hashmark = task.indexOf("#");
			if(hashmark >= 0){
				if(task.length <= hashmark+1)
					return undefined;
				task = task.substr(0, hashmark);
			}
			var pairs = task.split("&");
			var result ={};
			for (i = 0; i < pairs.length; i++) {
				let two = pairs[i].split("=");
				if(two.length != 2)
					return undefined;
				let key = decodeURIComponent(two[0]);
				let val = decodeURIComponent(two[1]);
				try{
					result[key] = val;
				} catch(e){
					alert("error: ilegal url. ignoring url parameters.");
					return undefined;
				}
			}
			return result;
		}


		function deformat_time(text){ // return milisec : can be improved
			if(text == undefined || text == "" ) {console.warn("invalid input, assume zero."); return 0;}
			var neg = (text.charAt(0) == '-');
			if(neg){text = text.substring(1);}
			var arr = text.split(":");
			var num = arr.length;
			var value = 0;
			if(num==3){value = 1000*(parseInt(arr[2]) + 60*(parseInt(arr[1])+ 60*arr[0]));}
			else if(num==2){value = 1000*(parseInt(arr[1]) + 60*(parseInt(arr[0])));}
			else if(num==1){value = 1000*(parseInt(arr[0]));}
			else value = NaN;
			return neg ? -value : value;
		}


		function format_time_title(milisec, view_seconds) {
			return format_time(milisec, view_seconds);
		}
		function format_time(milisec, view_seconds){
			milisec = parseInt(milisec);
			var minus = "";
			if(milisec < 0){minus = "-";}
			milisec = Math.abs(milisec);

			var one_uni = 1000;

			var one_s = 1;
			var one_m = 60*one_s;
			var one_h = 60*one_m;

			view_seconds = view_seconds || (milisec >= 0 && milisec < one_uni*one_m)

			var unisec = Math.round(milisec/one_uni);
			if(!view_seconds) unisec = Math.round(unisec / one_m) * one_m
			if(present_ringer && unisec<0){unisec=0;}
			if(unisec == 0){minus = "";}

			var hours = Math.floor(unisec/one_h);
			unisec = unisec - hours*one_h;
			
			var days = (use_days && hours >= 24) ? Math.floor(hours/24) + "d " : "";
			if (days) hours = hours % 24;
			
			var minutes = Math.floor(unisec/one_m);
			unisec = unisec - minutes*one_m;
			var seconds = Math.floor(unisec/one_s);
			unisec = unisec - seconds*one_s;

			minutes = minutes.toString();
			seconds = seconds.toString();

			if(minutes.length == 1) minutes = "0" + minutes;
			if(seconds.length == 1) seconds = "0" + seconds;

			if(view_seconds){
				if(hours == 0 && !days){ return minus + minutes + ":" + seconds; }
				else { return minus + days + hours.toString() + ":" + minutes + ":" + seconds; }
			} else {
				return minus + days + hours.toString() + ":" + minutes;
			}
		}




		function logtime(){
			let cln = document.getElementById("list_template").content.cloneNode(true);
			let tm = clock_format(new Date());
			let vl = present_value;

			cln.querySelector(".log-value").innerHTML = format_time(vl, true);
			cln.querySelector(".log-value").setAttribute("value",vl);
			cln.querySelector(".log-time").innerHTML = tm;
			cln.querySelector(".entry-set-btn").addEventListener("click", do_log_setup);
			cln.querySelector(".entry-remove-btn").addEventListener("click", do_log_remove);


			document.getElementById("log-table").prepend(cln);

			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.setAttribute("value", vl + Number(tot.getAttribute("value")));
			tot.innerHTML = format_time(Number(tot.getAttribute("value")), true);
			let lst = document.getElementById("log-last").querySelector(".log-value");
			lst.setAttribute("value", vl);
			lst.innerHTML = format_time(vl, true);
			let cnt = document.getElementById("log-count").querySelector(".log-value");
			cnt.setAttribute("value", 1 + Number(cnt.getAttribute("value")));
			cnt.innerHTML = cnt.getAttribute("value");
			return cln;
		} // end of logtime.

		function loglap(){
			logtime();
			startnew(); // set zero
		}

		function logpop(){
			let head = document.getElementById("log-table").querySelector("tr:first-of-type");
			if(head){
				do_setup(Number(head.querySelector(".log-entry-value").getAttribute("value")));
				logremove(head);
			} else {
				alert("Oops.. The log is empty.");
			}
		}

		function do_log_remove(){ // wrapper to logremove()
			let node = this.closest('.log-entry');
			if(node) {
				logremove(node);
			} else {
				alert("Well... isnt the log already empty?");
			}
		}
		function logremove(item) {
			if(!item){alert("Oops.. Something went wrong."); return;}
			let val = Number(item.querySelector(".log-entry-value").getAttribute("value"));

			let cnt = document.getElementById("log-count").querySelector(".log-value");
			cnt.setAttribute("value", Number(cnt.getAttribute("value")) - 1);
			cnt.innerHTML = cnt.getAttribute("value");

			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.setAttribute("value", Number(tot.getAttribute("value")) - val);
			tot.innerHTML = format_time(Number(tot.getAttribute("value")), true);

			item.remove();

			let head = document.getElementById("log-table").querySelector("tr:first-of-type");
			let lst = document.getElementById("log-last").querySelector(".log-value");
			if(head == null){
				lst.setAttribute("value", NaN);
				lst.innerHTML = "none";
			} else {
				lst.setAttribute("value", head.querySelector(".log-entry-value").getAttribute("value"));
				lst.innerHTML = format_time(Number(lst.getAttribute("value")), true);
			}
		} //end of logremove.

		function do_log_setup(){ // wrapper to logsetup()
			let node = this.closest('.log-entry');
			if(node) {
				logsetup(node);
			} else {
				alert("Well... isnt the log already empty?");
			}
		}
		function logsetup(item) {
			if(!item){alert("Oops.. Something went wrong."); return;}
			do_setup(Number(item.querySelector(".log-entry-value").getAttribute("value")));
		}

		function clearlogs(){
			document.getElementById("log-table").innerHTML = "";
			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.setAttribute("value", 0);
			tot.innerHTML = format_time(0, true);
			let lst = document.getElementById("log-last").querySelector(".log-value");
			lst.setAttribute("value", NaN);
			lst.innerHTML = "none";
			let cnt = document.getElementById("log-count").querySelector(".log-value");
			cnt.innerHTML = "0";
		}

		// ---- timerAPI: generic event interface for external consumers ----
		window.addEventListener("timerAPI:request", function(e) {
			var opts = (e.detail || {});
			var resp = {
				direction: present_direction ? "up" : "down",
				isRunning: !present_paused,
				value: format_time(present_value, true),
				rawValue: present_value
			};
			if (opts.include_log) {
				var rows = document.getElementById("log-table").querySelectorAll("tr.log-entry");
				resp.log = Array.from(rows, function(r) {
					return {
						value: Number(r.querySelector(".log-entry-value").getAttribute("value")),
						time: r.querySelector(".log-entry-time").textContent
					};
				});
			}
			window.dispatchEvent(new CustomEvent("timerAPI:response", { detail: resp }));
		});

		window.addEventListener("timerAPI:action", function(e) {
			var d = e.detail || {};
			var action = d.action;
			if      (action === "play")   resume();
			else if (action === "pause")  pause();
			else if (action === "toggle") myFlip();
			else if (action === "reset")  medium_reset();
			else if (action === "log")    logtime();
			else if (action === "lap")    loglap();
			else if (action === "clear-log") clearlogs();
			else if (action === "reverse") change_direction();
			else if (action === "advance-reset") {
				var t = d.value;
				if      (t === "ice")     winter_reset();
				else if (t === "full")    large_reset();
				else if (t === "round")   small_reset();
				else if (t === "regular") medium_reset();
				else console.warn("Unsupported reset type:", t);
			}
			else if (action === "set" && d.value != null) {
				var ms = deformat_time(String(d.value));
				if (ms != null && !isNaN(ms)) do_setup(ms);
			}
			else if (action === "add" && d.value != null) {
				var ms = deformat_time(String(d.value));
				if (ms != null && !isNaN(ms)) {
					applyState(present_value + ms, present_direction);
					set_start_as_present();
					myUpdate();
				}
			}
			else console.warn("Unsupported action:", action);
		});
