$(document).ready(function() {
	// 初期処理
	// 初期データをJSONに変換、配列に追加
	var words = [];
	$(".new_word").each(function() {
		words.push(JSON.parse($(this).text()));
		$(this).remove();
	});

	var new_word = words[0];

	// 過去のワードリストを生成
	var words_length = words.length;
	for (var i = 1; i < words.length; i++) {
		$("tbody").append("<tr>" +
			"<td>" + words[i].word_id + "</td>" + 
			"<td>" + words[i].word +
			" （" + words[i].hiragana + "）</td>" +  
			"<td>" + "<a href=" + words[i].amazon_link + 
			"><img src=" + words[i].image_url + ' style="height : 30px;" alt="アマゾンの画像リンク"></a></td>"' + 
			"<td>" + words[i].created_at + "</td>" + 
			"</tr>");
	}

	// 鯖接続開始
	var channel = new goog.appengine.Channel($("#token").val());
	var socket = channel.open({
		onopen : function(){
		},

		onmessage : function(message) {
			var data = JSON.parse(message.data);

			if(data.type == "error") {
				dispError(data.error_message);
			} else if (data.type == "new_word") {
				addWord(data);
			}
		},

		onerror : function(error) {
		},

		onclose : function(){
		}
	});

	// ワード投稿時
	$("#word_submit").submit(function(){
		// データ送信
		$.post("/", $(this).serialize());

		return false;
	});

	// 今のワード変更時
	function addWord(data) {
		// エラーメッセージ除去、更新
		$("#word_submit .help-block").text("しりとらず成功！");
		$("#word_submit").removeClass("has-error");

		// 投稿欄内ワードの消去
		$("#word_submit input[name='word']").val("");

		// 表示の更新
		$("#screen_word").text(data.word);
		$("#screen_hiragana").text(data.hiragana);

		$("#affiliate span").text(data.word);
		$("#affiliate a").attr("href", data.amazon_link);
		$("#affiliate img").attr("src", data.image_url);

		// 過去ワードリストに前のワードを追加
		$("tbody").prepend("<tr>" +
			"<td>" + new_word.word_id + "</td>" + 
			"<td>" + new_word.word +
			"（" + new_word.hiragana + "）</td>" + 
			"<td>" + "<a href=" + new_word.amazon_link + 
			"><img src=" + new_word.image_url + ' style="height : 30px;" alt="アマゾンの画像リンク"></a></td>"' + 
			"<td>" + new_word.created_at + "</td>" + 
			"</tr>");

		// new_word 更新
		new_word = data;
	}

	// エラーメッセージ表示
	function dispError(error_message) {
		// メッセージ表示
		$("#word_submit .help-block").text(error_message);
		$("#word_submit").addClass("has-error");
	}
});