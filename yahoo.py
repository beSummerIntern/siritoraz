#coding:utf-8

import config

import requests
from xml.etree.ElementTree import *

YAHOO_PARSE_URL = 'http://jlp.yahooapis.jp/FuriganaService/V1/furigana'

xmlns = '{urn:yahoo:jp:jlp:FuriganaService}'

def reading(text,appid=config.YAHOO_APP_ID):

  text = text.encode('utf-8')

  params = {
    'appid': appid,
    'sentence' : text
    }

  f = requests.get(YAHOO_PARSE_URL, params=params)
  r=''

  if f.status_code == 200:
    root = fromstring(unicode(f.text).encode("utf8"))
    for word in root.find(xmlns + "Result").find(xmlns + "WordList").findall(xmlns + 'Word'):
      if word.findtext(xmlns + 'Furigana'):
        r += word.findtext(xmlns + 'Furigana')
      else:
        r += word.findtext(xmlns + 'Surface')

  return r
