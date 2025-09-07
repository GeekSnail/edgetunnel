#!/bin/bash -x
ONCE_HOUR='^[0-9]+ \*(\/[0-8]) \* \* \*$'
ONCE_DAY='^[0-9]+ [0-9]+[^,\/]? \* \* \*$'
ONCE_WEEK='^[0-9]+ [0-9]+[^,\/]? \* \* [0-6]$'

once_hour() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_HOUR ]]
}
once_day() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_DAY ]]
}
once_week() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_WEEK ]]
}

json_array_tolines(){
  local arr="$1"
  [ -f "$1" ] && arr=`cat $1`
  echo "$arr"|tr -d '["]'|sed -r 's/, */\n/g'
}

file_lines_tojson(){
  local uniq=0; 
  [ "$1" = '-u' ] && uniq=1 && shift;
  echo [$(echo `cat $@|if [ "$uniq" = 1 ]; then sort -u; else cat; fi|sed -r 's/(.*)/"\1"/'`|tr -s ' ' ',')]
}

filterhost() {
  [ ! -s "$1" ] && echo file $1 is empty! >&2 && return
  [ -f tocheck.txt ] && rm tocheck.txt 2>/dev/null
  for d in `cat $1|sort -u`; do
    local ip=$(dig +short $d @8.8.8.8 | grep -v '\.$' | head -n1)
    [ -z "$ip" ] && continue
    [ "$ip" = '1.1.1.1' ] && ip=$(dig +short $d @223.5.5.5 | grep -v '\.$' | head -n1)
    [ ! -z "$ip" ] && [ "$ip" != '1.1.1.1' ] && echo $ip $d >> tocheck.txt
  done
  if [ -s tocheck.txt ]; then
    node .github/filterhost.mjs $2 tocheck.txt
  #else 
  #  > $1
  fi
}
