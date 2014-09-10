$(document).ready(function() {
	// 変数
	var enableSubmit = false;

	// 初期処理
	// 初期データをJSONに変換、配列に追加
	var words = [];
	$(".new_word").each(function() {
		words.push(JSON.parse($(this).text()));
		$(this).remove();
	});

	// 今のワードを保持
	var new_word = words[0];

	// 過去のワードリストを生成
	for (var i = words.length - 1; i > 0; i--) {
		addWord(words[i]);
	}

	// 鯖接続開始
	var channel = new goog.appengine.Channel($("#token").val());
	var socket = channel.open({
		// 鯖接続完了時
		onopen : function(){
			// カルーセル編集
			for (var i = words.length - 1; i >= 0; i--) {
				addCarouselWord(words[i]);
			}

			// タイトル処理
			setTimeout(function() {
				// タイトルをスライド
				$("#carousel").carousel("prev");

				// スライド後処理
				setTimeout(function() {
					// タイトル消去
					$("#carousel .carousel-inner > div").first().remove();
				
					// TODO スライドボタン追加
				}, 2000);

				enableSubmit = true;
			}, 1000);
		},

		// メッセージ受信
		onmessage : function(message) {
			var data = JSON.parse(message.data);

			// メッセージタイプ識別
			if(data.type == "error") {
				dispError(data.error_message);
			} else if (data.type == "new_word") {
				changeCurrentWord(data);
			}
		},

		onerror : function(error) {
		},

		onclose : function(){
		}
	});

	// ワード投稿時
	$("#word_submit").submit(function(){
		if (enableSubmit) {
			$.post("/", $(this).serialize());
			enableSubmit = false;
		}

		return false;
	});

	// 今のワード変更時
	function changeCurrentWord(data) {
		// エラーメッセージ除去、更新
		$("#word_submit .help-block").text("しりとらず成功！");
		$("#word_submit").removeClass("has-error");

		// 投稿欄内ワードの消去
		$("#word_submit input[name='word']").val("");

		// 表示の更新
		addCarouselWord(data);
		$("#carousel").carousel("next");

		$("#affiliate span").text(data.word);
		$("#affiliate a").attr("href", data.amazon_link);
		$("#affiliate img").attr("src", data.image_url);

		// 過去ワードリストに前のワードを追加
		addWord(new_word);

		// new_word 更新
		new_word = data;

		enableSubmit = true;
	}

	// 過去ワードリストに前のワードを追加
	function addWord(data) {
		$("tbody").prepend("<tr>" +
			"<td>" + data.word_id + "</td>" + 
			"<td>" + data.word +
			"（" + data.hiragana + "）</td>" + 
			"<td>" + "<a href=" + data.amazon_link + 
			"><img src=" + data.image_url + ' style="height : 30px;" alt="アマゾンの画像リンク"></a></td>"' + 
			"<td>" + data.created_at + "</td>" + 
			"</tr>");
	}

	// カルーセルにワードを追加
	function addCarouselWord(data) {
		$("#carousel .carousel-inner").append(
			'<div class="item"><span class="word">' + 
			data.word + '</span><br><span class="hiragana">' + 
			data.hiragana + '</span>');
	}

	// エラーメッセージ表示
	function dispError(error_message) {
		// メッセージ表示
		$("#word_submit .help-block").text(error_message);
		$("#word_submit").addClass("has-error");

		enableSubmit = true;
	}
});