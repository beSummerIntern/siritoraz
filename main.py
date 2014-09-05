# coding: UTF-8

import os
import urllib
import time

import bottlenose

from xml.etree.ElementTree import *

from google.appengine.ext import ndb

import jinja2
import webapp2

import config

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
  amazonlink = ndb.StringProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)

class MainPage(webapp2.RequestHandler):

  def get(self):
    words = Word.query().order(-Word.word_id)
    template_values = {
      'words': words
    }

    template = JINJA_ENVIRONMENT.get_template('index.html')
    self.response.write(template.render(template_values))

  def post(self):
    # テキストフィールドのワード取得
    post_word = self.request.get('word')

    # オートインクリメント
    next_id = Word.query().count() + 1

    image_url = ''

    # 503エラー対策
    retry_count = 0
    while retry_count < 5:
      try:
        res = config.amazon.ItemSearch(Keywords=post_word, SearchIndex='All', ItemPage='1', ResponseGroup="Images")
      except:
        retry_count += 1
        time.sleep(1)
        continue
      break

    # xml切り出し
    root = fromstring(res)
    Items = root.find(xmlns + 'Items')
    if len(Items):
      Item = Items.findall(xmlns + 'Item')
      if len(Item):
        ImageSets = Item[0].find(xmlns + 'ImageSets')
        ImageSet = ImageSets.find(xmlns + 'ImageSet')
        MediumImage = ImageSet.find(xmlns + 'MediumImage')
        image_url = MediumImage.findtext(xmlns + 'URL')

    word = Word(word_id=next_id, member_id=1, word=post_word, hiragana=post_word, amazonlink=image_url)
    word.put()
    self.redirect('/')


app = webapp2.WSGIApplication([
  ('/', MainPage)
  ], debug=True)
