$(document).ready(function() {
	// 鯖接続開始
	var channel = new goog.appengine.Channel($("#token").val());
	var socket = channel.open({
		onopen : function(){
		},

		onmessage : function(message) {
			addWord(JSON.parse(message.data));
		},

		onerror : function(error) {
		},

		onclose : function(){
		}
	});

	// ワード投稿時
	$("#word_submit").submit(function(){
		$.post("/", $(this).serialize(), function(response){
			// var data = JSON.parse(response);

			// addWord(data.message);
		});

		// ワード消去
		$(":text[name='word']").val("");

		return false;
	});

	// 今のワード変更時
	function addWord(data) {
		$("#screen_word").text(data.word);
		$("#screen_hiragana").text(data.hiragana);
	}
});