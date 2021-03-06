# coding: UTF-8

import os
import urllib
import time
import datetime
import random
import uuid
import re
import json

from xml.etree.ElementTree import *

from google.appengine.ext import ndb
from google.appengine.datastore.datastore_query import Cursor

from google.appengine.api import channel
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util

from google.appengine.api import memcache

import jinja2
import webapp2

import config
import yahoo

ROOTPATH = os.path.dirname(__file__)

xmlns = '{http://webservices.amazon.com/AWSECommerceService/2011-08-01}'

# memcacheのキー
USER_KEY = 'siritoraz'

JINJA_ENVIRONMENT = jinja2.Environment(
  loader = jinja2.FileSystemLoader([ROOTPATH, 'templates']),
  extensions = ['jinja2.ext.autoescape'],
  autoescape = True
  )

# dbモデルの定義
class Word(ndb.Model):
  word_id = ndb.IntegerProperty()
  member_id = ndb.IntegerProperty()
  word = ndb.StringProperty()
  hiragana = ndb.StringProperty()
  image_url = ndb.StringProperty()
  amazon_link = ndb.TextProperty()
  created_at = ndb.StringProperty()

# ChanncelAPI用のユーザークラスの定義
class User:
  def __init__(self, client_id, token):
    self.client_id = client_id
    self.token = token
    self.time = 0.0

  def update_time(self):
    self.time = time.time()

class MainPage(webapp2.RequestHandler):
  def get(self):
    # CookieからChannel TokenIDを取得
    client_id = self.request.cookies.get('client_id', '')
    token = self.request.cookies.get('token', '')

    if not (len(client_id) and len(token)):
      # Channel TokenIDを生成
      client_id = str(uuid.uuid4())
      token = channel.create_channel(client_id, 24 * 60)

      # クッキーの有効期限として１日後の時間を取得
      after_one_day_time = (datetime.datetime.now() + datetime.timedelta(hours=33)).strftime('%a, %d-%b-%Y %H:%M:%S GMT')

      # client_idをクッキーに保存
      myCookie = 'client_id=%s; expires=%s;' % (client_id, after_one_day_time)
      self.response.headers.add_header('Set-Cookie', myCookie)

      # tokenをクッキーに保存
      myCookie = 'token=%s; expires=%s;' % (token, after_one_day_time)
      self.response.headers.add_header('Set-Cookie', myCookie)

    # 同時接続しているユーザーのClient ID一覧を取得
    users = memcache.get(USER_KEY)
    if not users:
      users = []

    # クッキーのtokenと同じユーザーが登録されているかどうか
    isAddUser = False
    for user in users:
      if user.token == token:
        isAddUser = True

    # クッキーのtokenと同じユーザーが登録されていなければ新規に作成
    if not isAddUser:
      # ユーザークラスを作成する
      user = User(client_id, token)

      # 新しいClient IDを追加する
      users.append(user)
      memcache.set(USER_KEY, users, 60*60*24)

    # データストアからワードデータの取得
    words, cursor, more = Word.query().order(-Word.word_id).fetch_page(11)

    # TODO デプロイ時はコメントアウト
    if len(words) == 0:
      current_time = (datetime.datetime.now() + datetime.timedelta(hours=9))
      words = Word(word_id=1, member_id=0, word=u"しりとらず", hiragana=u"しりとらず", image_url="http://siritoraz.appspot.com/favicon.ico", amazon_link="http://siritoraz.appspot.com", created_at=current_time.strftime("%Y/%m/%d %H:%M:%S"))
      words.put()

    template_values = {
      'words': words,
      'token': token,
      'words_cursor': cursor.urlsafe(),
      'more_words': more
    }

    template = JINJA_ENVIRONMENT.get_template('index.html')
    self.response.write(template.render(template_values))

  def post(self):
    # 投稿者のトークンを取得
    token = self.request.get('token')

    # しりとらずのエラーメッセージ
    error_message = ''

    # テキストフィールドのワード取得
    post_word = self.request.get('word')

    if isSutegana(post_word[0]):
      error_message = 'ワードが「ぁぃぅ」などで始まっています！'

    # 同時接続中ユーザーのClient ID一覧を取得
    users = memcache.get(USER_KEY)

    # 5分以内の連続投稿の判定
    # for user in users:
    #   if user.token == token:
    #     if (time.time() - user.time) / 60 < 5:
    #       error_message = '5分以内に連続して投稿することは出来ません'

    if not len(error_message):
      # ワードのひらがな変換
      hiragana = yahoo.reading(post_word)

      if not isAlphabet(hiragana):
        error_message = 'ワードに英数字、特殊記号が入っています！'

      if not len(error_message):
        # IDのオートインクリメント
        post_count = Word.query().count()
        next_id = post_count + 1

        # しりとらず失敗判定(前回のワードの最後の文字と違うか)
        old_words = Word.query(Word.word_id == post_count)
        for old_word in old_words:
          while isSutegana(old_word.hiragana[len(old_word.hiragana)-1]):
            old_word.hiragana = old_word.hiragana[0:len(old_word.hiragana)-1]
          if hiragana[0] == old_word.hiragana[len(old_word.hiragana)-1]:
            error_message = u'「' + old_word.hiragana[len(old_word.hiragana)-1] + u'」で始まっています！'

        if not len(error_message):

          # しりとらず失敗判定(今までに同じワードが出たか)
          old_words = Word.query(Word.hiragana == hiragana)
          for old_word in old_words:
            if old_word.hiragana:
              error_message = str(old_word.word_id) + u'番目に同じワードが投稿されています！'

          if not len(error_message):
            image_url = ''
            amazon_link = ''

            # Amazonの503エラー対策
            retry_count = 0
            while retry_count < 5:
              try:
                # Amazon商品検索
                res = config.amazon.ItemSearch(Keywords=post_word, SearchIndex='All', ItemPage='1', ResponseGroup="Medium")
              except:
                retry_count += 1
                time.sleep(1)
                continue
              break

            # xml切り出し
            root = fromstring(res)
            Items = root.find(xmlns + 'Items')
            # 商品数
            TotalResults = Items.findtext(xmlns + 'TotalResults')
            if int(TotalResults) != 0:
              if len(Items):
                Item = Items.findall(xmlns + 'Item')
                if len(Item):
                  ImageSets = Item[0].find(xmlns + 'ImageSets')
                  if ImageSets:
                    ImageSet = ImageSets.find(xmlns + 'ImageSet')
                    Image = ImageSet.find(xmlns + 'MediumImage')
                    # 画像URL
                    image_url = Image.findtext(xmlns + 'URL')
                    # アフィリエイトURL
                    amazon_link = Item[0].findtext(xmlns + 'DetailPageURL')
            else:
              # しりとらず失敗
              error_message = '存在しないワードです！'

            if not len(error_message):
              # 現在時間の取得
              current_time = (datetime.datetime.now() + datetime.timedelta(hours=9))

              word = Word(word_id=next_id, member_id=0, word=post_word, hiragana=hiragana, image_url=image_url, amazon_link=amazon_link, created_at=current_time.strftime("%Y/%m/%d %H:%M:%S"))
              word.put()

              # 送信メッセージ用JSONの作成
              message = {
                'type': 'new_word',
                'word_id': word.word_id,
                'member_id': word.member_id,
                'word': word.word,
                'hiragana': word.hiragana,
                'image_url': word.image_url,
                'amazon_link': word.amazon_link,
                'created_at': str(word.created_at)
              }

              # 送信完了メッセージ用JSONの作成
              success = {
                'type': 'success'
              }

              for user in users:
                # 一人ずつ更新を通知する
                channel.send_message(user.token, json.dumps(message))
                if user.token == token:
                  # 送信者へ送信完了のメッセージを送信
                  channel.send_message(user.token, json.dumps(success))
                  user.update_time()

              memcache.set(USER_KEY, users, 60*60*24)

    if len(error_message):
      # エラーメッセージ用JSONの作成
      message = {
        'type': 'error',
        'error_message': error_message
      }

      # 投稿者に対してエラーメッセージを送信
      for user in users:
        if user.token == token:
          channel.send_message(user.token, json.dumps(message))

class MoreView(webapp2.RequestHandler):
  def post(self):
    # リクエストからJSONを取得
    json_data = self.request.body
    obj = json.loads(json_data)

    # データストアからワードデータの取得
    words, cursor, more = Word.query().order(-Word.word_id).fetch_page(10, start_cursor=Cursor(urlsafe=obj['cursor']))

    index = []

    for word in words:
      add_word = {
        'word_id': word.word_id,
        'member_id': word.member_id,
        'word': word.word,
        'hiragana': word.hiragana,
        'image_url': word.image_url,
        'amazon_link': word.amazon_link,
        'created_at': word.created_at
      }
      index.append(add_word)

    message = {
      'words': index,
      'words_cursor': cursor.urlsafe(),
      'more_words': more
    }

    self.response.write(json.dumps(message))

app = webapp2.WSGIApplication([
  ('/', MainPage),
  ('/more', MoreView)
], debug=False)

def isAlphabet(text):
  return re.search(u'^[(ぁ-ん)(ー)]+$', unicode(text))

def isSutegana(text):
  return re.search(u'[(ぁぃぅぇぉっゃゅょゎ)(ー)]', text)
