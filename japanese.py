# coding: UTF-8

import re

text = u'あいう.'

print re.search(u'[(a-zA-Z)( 　)(\(\)\.\^\$\*\+\?)]', text)