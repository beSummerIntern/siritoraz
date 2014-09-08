# coding: UTF-8

import os
import urllib
import time
import random

from xml.etree.ElementTree import *

from google.appengine.ext import ndb

from google.appengine.api import channel
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util

import jinja2
import webapp2

import config
import yahoo

ROOTPATH = os.path.dirname(__file__)

xmlns = '{http://webservices.amazon.com/AWSECommerceService/2011-08-01}'

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
  amazon_link = ndb.StringProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)


class MainPage(webapp2.RequestHandler):

  def get(self):
    # Channel TokenID 生成
    # source_str = 'abcdefghijklmnopqrstuvwxyz'
    # client_id = ""
    # client_id.join([random.choice(source_str) for x in xrange(10)])
    # client_id = '123456'
    # token = channel.create_channel(client_id)

    words = Word.query().order(-Word.word_id).fetch(11)

    # TODO デプロイ時は削除
    if len(words) == 0:
      words = Word(word_id=1, member_id=0, word=u"しりとらず", hiragana=u"しりとらず", image_url="", amazon_link="")
      words.put()

    template_values = {
      'words': words,
      # 'token': token
    }

    template = JINJA_ENVIRONMENT.get_template('index.html')
    self.response.write(template.render(template_values))

  def post(self):
    token = self.request.get('token')

    # しりとらずの失敗判定の初期化
    isFailed = False

    # テキストフィールドのワード取得
    post_word = self.request.get('word')

    if post_word != '':
      # IDのオートインクリメント
      post_count = Word.query().count()
      next_id = post_count + 1

      # ワードのひらがな変換
      hiragana = yahoo.reading(post_word)

      # しりとらず失敗判定
      old_words = Word.query(Word.word_id == post_count)
      for old_word in old_words:
        if hiragana[0] == old_word.hiragana[len(old_word.hiragana)-1]:
          isFailed = True

      image_url = ''
      amazon_link = ''

      # 503エラー対策
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
            ImageSet = ImageSets.find(xmlns + 'ImageSet')
            Image = ImageSet.find(xmlns + 'SmallImage')
            # 画像URL
            image_url = Image.findtext(xmlns + 'URL')
            # アフィリエイトURL
            amazon_link = Item[0].findtext(xmlns + 'DetailPageURL')
      else:
        # しりとらず失敗
        isFailed = True

      if not isFailed:
        word = Word(word_id=next_id, member_id=0, word=post_word, hiragana=hiragana, image_url=image_url, amazon_link=amazon_link)
        word.put()

        # channel.send_message(token, word)

    self.redirect('/')
    # self.response.out.write('/main')


app = webapp2.WSGIApplication([
  ('/', MainPage)
  ], debug=True)
