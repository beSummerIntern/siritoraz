$(document).ready(function() {
	// 変数
	var enableSubmit = false;
	var num_item = 0;

	// 初期処理
	// 初期データをJSONに変換、配列に追加
	var words = [];
	$(".new_word").each(function() {
		words.push(JSON.parse($(this).text()));
		$(this).remove();
	});
	var words_length = words.length;

	// 今のワードを保持
	var new_word = words[0];

	// 過去のワードリストを生成
	for (var i = words_length - 1; i > 0; i--) {
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

					// スライドボタン追加
					$("#carousel_button").css("visibility", "visible");

					// カルーセルのスワイプ移動を許可
					enableCarouselSwipe(getCookie("releaseStatus"));

					// プレイスホルダー編集
					var hiragana = findStrongLetter(new_word.hiragana);
					$("#word_submit input[name='word']").attr("placeholder", "「" + hiragana.strong_letter + "」から始まらないワードを入れてください");
				}, 1500);

				enableSubmit = true;
			}, 1500);
		},

		// メッセージ受信
		onmessage : function(message) {
			var data = JSON.parse(message.data);

			// メッセージタイプ識別
			if(data.type == "error") {
				dispError(data.error_message);
			} else if (data.type == "new_word") {
				changeCurrentWord(data);
			} else if (data.type == "success") {
				siritorazSuccess();
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
			// しりとらず判定中メッセージ
			$("#word_submit .help-block").text("しりとらず判定中．．．");
			$("#word_submit").removeClass("has-error");

			// カルーセルを今のワードへフォーカス
			$("#carousel").carousel($("#carousel .carousel-inner").find(".item").length - 1);

			$.post("/", $(this).serialize());
			enableSubmit = false;
		}
		return false;
	});

	// もっと見るボタン押下時
	$("#more_view").click(function(e) {
		if ($(".more_words").text()) {
			json_data = {cursor: $(".words_cursor").text()};
			$.ajax({
				type: "POST",
				// TODO デプロイ時は下を使う
				url: "/more",
				// url: "http://siritoraz.appspot.com/more",
				datatype: "json",
				contentType: "application/json; charset=utf-8",
				data: JSON.stringify(json_data),
				success: function(obj) {
					var data = JSON.parse(obj);
					$(".more_words").text(data.more_words);
					$(".words_cursor").text(data.words_cursor);
					for(var i = 0; i < data.words.length; i++) {
						addWordAppend(data.words[i]);
					}
				},
				error: function(obj) {
				}
			});
		}
		return false;
	});

	// 今のワード変更時
	function changeCurrentWord(data) {
		// プレイスホルダー編集
		var hiragana = findStrongLetter(data.hiragana);
		$("#word_submit input[name='word']").attr("placeholder", "「" + hiragana.strong_letter + "」から始まらないワードを入れてください");

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

		enableSubmit = true;
	}

	// 過去ワードリストに前のワードを追加
	function addWord(data) {
		$("tbody").prepend("<tr>" +
			"<td>" + data.word_id + "</td>" +
			"<td>" + data.word +
			" （" + data.hiragana + "）</td>" +
			"<td>" + "<a href=" + data.amazon_link +
			"><img src=" + data.image_url + ' style="height : 30px;" alt="アマゾンの画像リンク"></a></td>"' +
			"<td>" + data.created_at + "</td>" +
			"</tr>");
	}

	// 過去ワードリストの後ろにワードを追加
	function addWordAppend(data) {
		$("tbody").append("<tr>" +
			"<td>" + data.word_id + "</td>" +
			"<td>" + data.word +
			" （" + data.hiragana + "）</td>" +
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
		num_item++;

		if(num_item > words_length) {
			$("#carousel .carousel-inner > .item").eq(num_item - 2).children("h2").css("visibility", "hidden");
		} else if(num_item >= 2) {
			$("#carousel .carousel-inner > .item").eq(num_item - 1).children("h2").css("visibility", "hidden");
		}
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
		var cookieLimitTime = new Date(new Date().getTime() + 365*24*60*60*1000);
		if(!getCookie("releaseStatus")) {
			document.cookie = "releaseStatus=0; expires=" + cookieLimitTime;
		}

		if(!getCookie("postCount")) {
			document.cookie = "postCount=0; expires=" + cookieLimitTime;
		}

		if(!getCookie("lastPostTime")) {
			document.cookie = "lastPostTime=0; expires=" + cookieLimitTime;
		}
	}

	// 機能解放の判定
	function functionRelease(status, count) {
		// 初めての投稿
		if(status == "0" && count == "1") {
			document.cookie = "releaseStatus=1";
		}
		// ２回目の投稿
		else if(status == "1" && count == "2") {
			document.cookie = "releaseStatus=2";
		}
		// ３回目の投稿
		else if(status == "2" && count == "3") {
			document.cookie = "releaseStatus=3";
		}
		// ４回目の投稿
		else if(status == "3" && count == "4") {
			document.cookie = "releaseStatus=4";
		}
		// ５回目以降の投稿（全解放）
		else if(status == "4" && parseInt(count) >= 5) {
			document.cookie = "releaseStatus=5";
		}
	}

	// 機能解放の通知
	function pushModal(status) {
		// 初めての投稿
		if(status == "1") {
			$("#achieve").text("しりとらずを初めて成功させる");
			$("#reword_function").text("アマゾン画像リンク");
			$("#next_achieve").text("しりとらずを２回成功させる");
			$('#myModal').modal("toggle");
		}
		// ２回目の投稿
		else if(status == "2") {
			$("#achieve").text("しりとらずを２回成功させる");
			$("#reword_function").text("過去ワードの閲覧");
			$("#next_achieve").text("しりとらずを３回成功させる");
			$('#myModal').modal("toggle");
		}
		// ３回目の投稿
		else if(status == "3") {
			$("#achieve").text("しりとらずを３回成功させる");
			$("#reword_function").text("過去ワードリスト");
			$("#next_achieve").text("しりとらずを４回成功させる");
			$('#myModal').modal("toggle");
		}

		// ４回目の投稿
		else if(status == "4") {
			$("#achieve").text("しりとらずを４回成功させる");
			$("#reword_function").text("もっと見る");
			$("#next_achieve").text("自分で探してください");
			$('#myModal').modal("toggle");
		}
	}

	// 機能解放状態による画面表示非表示の変更
	function changeVisibility(status) {
		if(parseInt(status) > 0) {
			// アマゾン広告の表示
			$("#affiliate").css("display", "block");

			if(parseInt(status) > 1) {
				// カルーセルボタンの表示
				$("#carousel_button").css("display", "block");

				if(parseInt(status) > 2) {
					// 過去ワードリストの表示
					$("#past_wordlist").css("display", "block");

					if(parseInt(status) > 3) {
						// もっと見るボタンの表示
						$("#more_view").css("display", "block");
					}
				}
			}
		}
	}

	// カルーセルのスワイプ移動を許可
	function enableCarouselSwipe(status) {
		if(parseInt(status) > 1) {
			$("#carousel").carousel().swipe({
				swipeLeft:function(event, direction, distance, duration, fingerCount) {
					$(this).carousel('next');
				},
				swipeRight:function(event, direction, distance, duration, fingerCount) {
					$(this).carousel('prev');
				}
			});
		}
	}

	// 投稿回数を増やす
	function addPostCount(count) {
		count++;
		document.cookie = "postCount=" + encodeURIComponent(String(count));
	}

	// 投稿時間の更新
	function updateTime() {
		document.cookie = "lastPostTime=" + String(new Date().getTime());
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

	function siritorazSuccess() {
		// エラーメッセージ除去、更新
		$("#word_submit .help-block").text("しりとらず成功！");
		$("#word_submit").removeClass("has-error");

		// 投稿欄内ワードの消去
		$("#word_submit input[name='word']").val("");

		// クッキーの投稿回数を1回増やす
		addPostCount(parseInt(getCookie("postCount")));

		// 投稿時間の更新
		updateTime();

		// 機能解放の判定
		functionRelease(getCookie("releaseStatus"), getCookie("postCount"));

		// 機能解放状態による画面表示非表示の変更
		changeVisibility(getCookie("releaseStatus"));

		// 機能解放の通知
		pushModal(getCookie("releaseStatus"));
	}
});
