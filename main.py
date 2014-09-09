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
  created_at = ndb.DateTimeProperty(auto_now_add=True)

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
    # Channel TokenID 生成
    client_id = str(uuid.uuid4())
    token = channel.create_channel(client_id)

    # 同時接続しているユーザーのClient ID一覧を取得
    users = memcache.get(USER_KEY)
    if not users:
      users = []

    # ユーザークラスを作成する
    user = User(client_id, token)

    # 新しいClient IDを追加する
    users.append(user)
    memcache.set(USER_KEY, users)

    # データストアからワードデータの取得
    words = Word.query().order(-Word.word_id).fetch(11)

    # TODO デプロイ時は削除
    if len(words) == 0:
      words = Word(word_id=1, member_id=0, word=u"しりとらず", hiragana=u"しりとらず", image_url="", amazon_link="")
      words.put()

    template_values = {
      'words': words,
      'token': token
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

    # 5分以内の連続投稿の判定
    # users = memcache.get(USER_KEY)
    # for user in users:
    #   if user.token == token:
    #     if (time.time() - user.time) / 60 < 5:
    #       error_message = '5分以内に連続して投稿することは出来ません'

    if error_message == '':
      # IDのオートインクリメント
      post_count = Word.query().count()
      next_id = post_count + 1

      # ワードのひらがな変換
      hiragana = yahoo.reading(post_word)

      if isAlphabet(hiragana):
        error_message = 'ワードに英数字、特殊記号が入っています！'

      # しりとらず失敗判定(前回のワードの最後の文字と違うか)
      old_words = Word.query(Word.word_id == post_count)
      for old_word in old_words:
        while isSutegana(old_word.hiragana[len(old_word.hiragana)-1]):
          old_word.hiragana = old_word.hiragana[0:len(old_word.hiragana)-1]
        if hiragana[0] == old_word.hiragana[len(old_word.hiragana)-1]:
          error_message = u'「' + old_word.hiragana[len(old_word.hiragana)-1] + u'」で始まっています！'

      # しりとらず失敗判定(今までに同じワードが出たか)
      old_words = Word.query(Word.hiragana == hiragana)
      for old_word in old_words:
        if old_word.hiragana:
          error_message = str(old_word.word_id) + u'番目に同じワードが投稿されています！'

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
              Image = ImageSet.find(xmlns + 'SmallImage')
              # 画像URL
              image_url = Image.findtext(xmlns + 'URL')
              # アフィリエイトURL
              amazon_link = Item[0].findtext(xmlns + 'DetailPageURL')
      else:
        # しりとらず失敗
        error_message = '存在しないワードです！'

      if error_message == '':
        word = Word(word_id=next_id, member_id=0, word=post_word, hiragana=hiragana, image_url=image_url, amazon_link=amazon_link)
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

        # 同時接続中ユーザーのClient ID一覧を取得
        users = memcache.get(USER_KEY)
        for user in users:
          # 一人ずつ更新を通知する
          channel.send_message(user.token, json.dumps(message))
          if user.token == token:
            # user.update_time()
            user.time = time.time()

        memcache.set(USER_KEY, users)

    if not error_message == '':
      message = {
        'type': 'error',
        'error_message': error_message
      }

      users = memcache.get(USER_KEY)
      # 投稿者に対してエラーメッセージを送信
      for user in users:
        if user.token == token:
          channel.send_message(user.token, json.dumps(message))

app = webapp2.WSGIApplication([
  ('/', MainPage)
  ], debug=True)

def isAlphabet(text):
  return re.search(u'[(1-9)(１-９)(a-zA-Z)(ａ-ｚＡ-Ｚ)(\ \　\(\)\.\^\$\*\+\?)]', text)

# def isJapanese(text):
#   return re.search(u'^[ぁ-ん]+$', text)

def isSutegana(text):
  return re.search(u'[(ぁぃぅぇぉっゃゅょゎ)(ァィゥェォヵッャュョヮ)(\ー\-)]', text)
