#coding:utf-8

import config

import requests
from xml.etree.ElementTree import *

YAHOO_PARSE_URL = 'http://jlp.yahooapis.jp/MAService/V1/parse'

xmlns = '{urn:yahoo:jp:jlp}'

def reading(text,appid=config.YAHOO_APP_ID,results='ma',filter=''):

  text = text.encode('utf-8')

  params = {
    'appid': appid,
    'sentence' : text,
    'results' : results,
    'response' : 'surface,reading',
    'filter' : filter
    }

  f = requests.get(YAHOO_PARSE_URL, params=params)
  r=''

  if f.status_code == 200:
    root = fromstring(unicode(f.text).encode("utf8"))
    for word in root.find(xmlns + "ma_result").find(xmlns + "word_list").findall(xmlns + 'word'):
      # print word.findtext(xmlns + 'reading')
      r += word.findtext(xmlns + 'reading')

  return r
