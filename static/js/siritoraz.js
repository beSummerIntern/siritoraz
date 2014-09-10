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

	// 初訪問時のクッキー初期化
	initCookies();
	// クッキーの機能解放状態による画面表示非表示の変更
	changeVisibility(getCookie("releaseStatus"));

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
			// カルーセルを今のワードへフォーカス
			$("#carousel").carousel($("#carousel .carousel-inner").find(".item").length - 1);

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

		// カルーセル追加
		addCarouselWord(data);

		// カルーセルを今のワードへフォーカス
		$("#carousel").carousel($("#carousel .carousel-inner").find(".item").length - 1);
		
		$("#affiliate span").text(data.word);
		$("#affiliate a").attr("href", data.amazon_link);
		$("#affiliate img").attr("src", data.image_url);

		// 過去ワードリストに前のワードを追加
		addWord(new_word);

		// new_word 更新
		new_word = data;

		// クッキーの投稿回数を1回増やす
		addPostCount(parseInt(getCookie("postCount")));

		// 機能解放の判定
		functionRelease(getCookie("releaseStatus"), getCookie("postCount"));

		// 機能解放状態による画面表示非表示の変更
		changeVisibility(getCookie("releaseStatus"));

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
		var string_data = findStrongLetter(data.hiragana);

		$("#carousel .carousel-inner").append(
			'<div class="item">' + 
			'<h2 style="visibility: visible">今のワード</h2>' + 
			'<span class="word">' + 
			data.word + '</span><br><span class="hiragana">' + 
			string_data.first_string + '</span><span class="last_letter text-danger">' + 
			string_data.strong_letter + '</span><span class="hiragana">' + 
			string_data.last_string + '</span>');
	}

	// エラーメッセージ表示
	function dispError(error_message) {
		// メッセージ表示
		$("#word_submit .help-block").text(error_message);
		$("#word_submit").addClass("has-error");

		enableSubmit = true;
	}

	// 指定した要素のクッキーデータを取得
	function getCookie(name) {
		var result = null;

		var cookieName = name + '=';
		var allcookies = document.cookie;

		var position = allcookies.indexOf(cookieName);
		if(position != -1) {
			var startIndex = position + cookieName.length;

			var endIndex = allcookies.indexOf(';', startIndex);
			if(endIndex == -1) {
				endIndex = allcookies.length;
			}

			result = decodeURIComponent(allcookies.substring(startIndex, endIndex));
		}

		return result;
	}

	// 初訪問時のクッキー初期化
	function initCookies() {
		if(!getCookie("releaseStatus")) {
			document.cookie = "releaseStatus=0";
		}

		if(!getCookie("postCount")) {
			document.cookie = "postCount=0";
		}

		if(!getCookie("lastPostTime")) {
			document.cookie = "lastPostTime=0";
		}
	}

	// 機能解放の判定
	function functionRelease(status, count) {
		// 初めての投稿
		if(status == "0" && count == "1") {
			document.cookie = "releaseStatus=1";
		}
	}

	// 機能解放状態による画面表示非表示の変更
	function changeVisibility(status) {
		if(parseInt(status) > 0) {
			$("#affiliate").css("display", "block");

			if(parseInt(status) > 1) {
				$("#carousel_button").css("visibility", "visible");

				if(parseInt(status) > 2) {
					$("#past_wordlist").css("display", "block");
				}
			}
		}
	}

	// 投稿回数を増やす
	function addPostCount(count) {
		count++;
		document.cookie = "postCount=" + encodeURIComponent(String(count));
	}

	// 末尾文字抽出
	function findStrongLetter(hiragana) {
		var data = {
			first_string : "",
			strong_letter : "",
			last_string : ""
		};
		var index = 0;

		for (var i = 1; i <= hiragana.length; i++) {
			var character = "" + hiragana[hiragana.length - i];
			if(character.search(/[(ぁぃぅぇぉっゃゅょゎ)(ー)]/) < 0) {
				index =  hiragana.length - i;
				break;
			}
		}

		data.first_string = hiragana.substring(0, index);
		data.strong_letter = hiragana[index];
		data.last_string = hiragana.substring(index + 1);

		return data;
	}
});