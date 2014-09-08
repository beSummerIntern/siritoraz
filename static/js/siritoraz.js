$(document).ready(function() {

	// ワード投稿時
	$("#word_submit").submit(function(){
		$.post("/", $(this).serialize(), function(response){
			var data = JSON.parse(response);

			addWord(data.message);
		});

		// ワード消去
		$(":text[name='word']").val("");

		return false;
	});

	// 今のワード変更時
	function addWord(word) {
		$("#screen_word").text(word.word);
		$("#screen_hiragana").text(word.hiragana);
	}
});