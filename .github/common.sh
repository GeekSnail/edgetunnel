#!/bin/bash -x
ONCE_HOUR='^[0-9]+ \* \* \* \*$'
ONCE_DAY='^[0-9]+ [0-9]+ \* \* \*$'
ONCE_WEEK='^[0-9]+ [0-9]+ \* \* [0-6]$'
WEEK_PLAN='^[0-9]+ [0-9]+ \* \* [0-6]((,[0-6])+)?$'

once_hour() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_HOUR ]]
}
once_day() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_DAY ]]
}
once_week() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $ONCE_WEEK ]]
}
week_plan() {
  [ -z "$SCHEDULE" ] || [[ "$SCHEDULE" =~ $WEEK_PLAN ]]
}

orig_owner() {
  [ "$OWNER" = 'GeekSnail' ]
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

check_secrets() {
  if [ -z $CF_ACCOUNT_ID ] || [ -z $CF_API_TOKEN ] || [ -z $CF_NAMESPACE_ID ]; then
    echo "CF_ACCOUNT_ID, CF_API_TOKEN and CF_NAMESPACE_ID is required!" | tee $GITHUB_STEP_SUMMARY && exit 1; 
  fi
}
# ip workflow
get(){
  local cnt=0
  while [ $cnt -lt 3 ] && ! curl --connect-timeout 10 --retry 1 "$1" -o $2; do
    sleep 1
    cnt=$(($cnt+1))
    echo 'retry...'
  done
  [ $cnt -lt 3 ]
}
down_ip() {
  check_secrets
  for url in https://zip.cm.edu.kg/all.txt https://ipdb.api.030101.xyz/?type=proxy; do
    if get $url all.txt && [ -s all.txt ]; then
      if grep 443 all.txt; then
        grep 443 all.txt | sed 's/:.*//' | sort | uniq > ip.txt
      else
        mv all.txt ip.txt
      fi
      echo ipupdate `wc -l ip.txt` | tee $GITHUB_STEP_SUMMARY
      break
    fi
  done
  [ -s all.txt ] || (echo "Failed to download ip data!" && exit 1);
}
merge_ip(){
  for key in $PROXYS_BAK $PROXYS; do
    local ret=`curl -H "$AUTH" "$CF_KV_API/$key"`
    if echo "$ret"|grep error; then
      grep 'namespace not found' <<< "$ret" && exit 1 || echo "$ret"
    elif [ ! -z "$ret" ] && ! grep -e '443":\s*\[\]' <<< "$ret"; then
      echo "$ret" |tr -d '{ "[]}'|sed -r 's/\w+://g' |tr -s ',' '\n' >> ip.txt
      break;
    fi
  done
  cat $PROXYS_JSON|tr -d '{ "[]}'|sed -r 's/\w+://g' |tr -s ',' '\n' >> ip.txt
  cat ip.txt | sed '/^$/d' | sort | uniq > tmp.txt && mv tmp.txt ip.txt
  echo merge `wc -l ip.txt` | tee $GITHUB_STEP_SUMMARY
}
UA="Mozilla/5 (Linux; Android 11; Pixel 5) AppleWebKit/537 Chrome/107 Mobile Safari/537"
test_ip(){
  set +e
  TRACE_URL="$TRACE_HOST$TRACE_PATH"
  OPENAI_HOST='android.chat.openai.com'; OPENAI_PATH='/public-api/mobile/server_status/v1'; 
  OPENAI_URL="$OPENAI_HOST$OPENAI_PATH"
  X_HOST='twitter.com'
  # ip port host path method?
  req_data(){
    local p=http; [ $2 -eq 443 ] && p=https
    local m=HEAD; [ ! -z $5 ] && m=$5
    echo '{"type":"http","target":"'$1'","locations":[{"country":"'$PING_COUNTRY'","limit":'$PING_LIMIT'}],"measurementOptions":{"port":'$2',"protocol":"'$p'","request":{"method":"'$m'","host":"'$3'","path":"'$4'"}}}'
  }
  # ret
  get_avg(){
    local n=$PING_LIMIT avg=0
    local m=`echo $1|tr -s '{,}' '\n'|grep total|cut -d ':' -f2`
    for t in $m; do 
      [ $t = null ] && n=$(($n-1)) || avg=$(($avg+$t)); 
    done
    [ $n -gt 0 ] && echo $(($avg/$n)) || echo 0
  }
  # data
  measure(){
    local url=`curl -H "content-type: application/json" -A "$UA" \
      -d "$1" -si "$PING_API"|grep location|awk '{print $2}'|tr -d '\n\r'`
    [ -z $url ] && echo 'error: no url' && exit 1
    sleep 1
    while true; do
      local r=`curl -A "$UA" -s "$url"`
      grep -q 'in-progress' <<< "$r" && sleep 1 && continue;
      break;
    done
    echo -n "$url" >&2
    echo "$r"
  }
  # ip port
  measure_http(){
    [ -z $1 ] && echo 'error: no ip' && return
    local ip=$1 port=$2
    [ -z "$port" ] && port=443
    local d=`req_data "$ip" $port "$TRACE_HOST" "$TRACE_PATH"`
    local r=`measure $d`
    local avg=0
    avg=`get_avg "$r"`
    local msg=" $ip:$port $avg"
    case "$r" in
      # *authorized\":*)
      #   local d=`echo $r|tr -s '{,.}' '\n'|grep expiresAt|grep -v null|tr -s '"T' ' '|awk '{printf "%s %s\n",$3,$4}'|head -n 1`
      #   [ -z "$d" ] || [ $((`date -d "$d" +%s`-`date +%s`)) -lt 86400 ]
      *cloudflare*statusCode\":200*)
        echo "$msg"
        [ $avg -gt 0 ] && [ $avg -lt $HTTP_DELAY ] && echo "$ip" >> ip$port.txt;
        ;;
      *)
        echo
        ;;
    esac
  }
  measure_openai(){
    [ -z $1 ] && echo 'error: no ip' && return
    local ip=$1 port=443
    # https://api.openai.com/compliance/cookie_requirements 
    local d=`req_data "$ip" $port "$OPENAI_HOST" "$OPENAI_PATH" GET`
    local r=`measure $d`
    local avg=0
    avg=`get_avg "$r"`
    local msg=" $ip:$port $avg"
    case "$r" in
      *status\\\":\\\"normal*statusCode\":200*)
        echo "$msg normal"
        echo "$ip" >> ipopenai.txt
        ;;
      #*disallowed\ ISP*)
      #  echo "$msg disallowed ISP"
      #	[ $avg -gt 0 ] && [ $avg -lt $HTTP_DELAY ] && echo "$ip" >> ip$port.txt
      #	;;
      #*unsupported_country*)
      #  echo "$msg unsupported_country"
      #	[ $avg -gt 0 ] && [ $avg -lt $HTTP_DELAY ] && echo "$ip" >> ip$port.txt
      #	;;
      *)
        echo "$msg"
        ;;
    esac
  }

  probe_http(){
    [ -z $1 ] && echo 'error: no ip' && return
    local ip=$1 port=$2 p=http
    [ -z "$2" ] && port=443
    [ $port -eq 443 ] && p=https
    eval `curl -I --connect-timeout 5 -so /dev/null -w 'local code=%{http_code} time=%{time_connect}' --connect-to $TRACE_HOST:$port:$ip:$port $p://$TRACE_URL`
    
    if [ "$code" = 200 ]; then
      local ms=`echo "scale=0; $time*1000/1" | bc`
      if [ $ms -gt 0 ] && [ $ms -lt $HTTP_DELAY ]; then
        echo $ip:$port $ms
        echo $ip >> ip$port.txt
      fi
    fi
  }
  probe_openai(){
    [ -z $1 ] && echo 'error: no ip' && return
    local ip=$1 port=443 p=https
    local r=`curl -A "UA" --connect-timeout 5 -s -w ' code=%{http_code}' --connect-to $OPENAI_HOST:$port:$ip:$port $p://$OPENAI_URL`
    eval `echo $r|sed -r 's/^.*(code=.*)$/local \1/'`
    [ ! -z $code ] && [ $code != 000 ] && echo $ip:$port $r
    if [ $code = 200 ]; then
      echo $ip >> ipopenai.txt
    elif [ $code != 400 ] || echo "$r"|grep 'html'; then
      sed -i '/'$ip'/d' ip$port.txt
    fi
  }
  probe_x(){
    [ -z $1 ] && echo 'error: no ip' && return
    local ip=$1 port=443 p=https
    eval `curl -A "UA" --connect-timeout 5 -so /dev/null -w 'local code=%{http_code}' --connect-to $X_HOST:$port:$ip:$port $p://$X_HOST/`
    if [ "$code" = 301 ] || [ "$code" = 302 ] || [ "$code" = 200 ]; then
      echo $ip >> ipx.txt
    fi
  }

  # while IFS= read -r ip; do
    # measure_http $ip 443
  # done < ip.txt
  # while IFS= read -r ip; do
    # measure_openai $ip
    # measure_http $ip 80
  # done < ip443.txt
  while IFS= read -r ip; do
    probe_http $ip 443
  done < ip.txt
  echo "databak={\"443\":[$(echo `sed -r 's/^(.*)$/"\1"/' ip443.txt`|tr -s ' ' ',')]}" >> $GITHUB_ENV;
  while IFS= read -r ip; do
    probe_http $ip 80
    probe_openai $ip
    probe_x $ip
    [ `sed -n '$=' ipx.txt` -ge 300 ] && [ `sed -n '$=' ip80.txt` -ge 10 ] && break;
  done < ip443.txt
  echo `wc -l ip443.txt`| tee $GITHUB_STEP_SUMMARY
  echo `wc -l ip80.txt` | tee -a $GITHUB_STEP_SUMMARY
  echo `wc -l ipopenai.txt`| tee -a $GITHUB_STEP_SUMMARY
  echo `wc -l ipx.txt`| tee -a $GITHUB_STEP_SUMMARY
}
put_ip() {
  local data=
  for i in 443 80 openai x; do
    [ ! -z $data ] && data=$data,
    if [ -s ip$i.txt ]; then
      head -n 300 ip$i.txt > tmp && mv tmp ip$i.txt
      data=$data\"$i\":[$(echo `sed -r 's/^(.*)$/"\1"/' ip$i.txt`|tr -s ' ' ',')]
    else
      data=$data\"$i\":[]
    fi
  done
  data={$data}
  curl -X PUT -H "$AUTH" -d "$databak" "$CF_KV_API/$PROXYS_BAK"
  curl -X PUT -H "$AUTH" -d "$data" "$CF_KV_API/$PROXYS"
  curl -X PUT -H "$AUTH" -d `date '+%F %T %Z%z'` "$CF_KV_API/$PROXYS_UPDATED"
  # echo "data=$data" >> $GITHUB_OUTPUT

  echo $data > $PROXYS_JSON
  if [ `git diff $PROXYS_JSON | wc -l` != 0 ]; then
    git config user.name "GitHub Actions Bot"
    git config user.email "<>"
    git add $PROXYS_JSON
    git commit -m "update $PROXYS_JSON"
    git push
    echo "$PROXYS_JSON changed." >> $GITHUB_STEP_SUMMARY
    echo "shouldDeploy=true" >> $GITHUB_OUTPUT
  fi
}

# cfhost workflow
check_cfhost() {
  check_secrets
  if orig_owner && week_plan; then
    [ $EVENT_NAME = workflow_call ] && git pull --rebase
    echo check $CFHOSTPAT_JSON ...
    node $CFHOSTPAT_JS toLines > pat.txt
    filterhost pat.txt handlePat
  fi
  
  json_array_tolines $CFHOST_JSON > local.txt
  echo "$CFHOST_JSON - `wc -l local.txt`" >> $GITHUB_STEP_SUMMARY
  if orig_owner && week_plan && [ -s local.txt ]; then
    echo check $CFHOST_JSON ...
    filterhost local.txt > tmp
    [ ! -s tmp ] && echo 'maybe filterhost error!' && exit 1
    file_lines_tojson tmp > $CFHOST_JSON
    mv tmp local.txt
    echo "filter, `wc -l local.txt`" >> $GITHUB_STEP_SUMMARY
  fi
  
  local ret=`curl -H "$AUTH" "$CF_KV_API/$CFHOST"`
  if echo "$ret"|grep error; then
    grep 'namespace not found' <<< "$ret" && exit 1 || echo "$ret"
  elif [ ! -z "$ret" ] && [ "$ret" != "[]" ]; then
    json_array_tolines $ret > remote.txt
    echo "get kv $CFHOST, `wc -l remote.txt`" >> $GITHUB_STEP_SUMMARY
    
    if once_day || week_plan; then
      local bak=`curl -H "$AUTH" "$CF_KV_API/$CFHOST_BAK"`
      if ! echo "$bak"|grep error && [ ! -z "$bak" ] && [ "$bak" != "[]" ]; then
        json_array_tolines $bak > remote_bak.txt
        cat remote_bak.txt >> remote.txt
        sort -uo remote.txt remote.txt
        echo "get kv $CFHOST_BAK, merge, `wc -l remote.txt`" >> $GITHUB_STEP_SUMMARY
      fi
    fi
      
    #diff -b --suppress-common-lines remote.txt local.txt | grep '<' | sed 's/< *//' > remote.txt
    comm -23 <(sort remote.txt) <(sort local.txt) > tmp && mv tmp remote.txt
    # diff after manually update cfhostpat.json
    echo "check kv cfhost ..."
    local pat='^((xn--)?[a-z0-9]([a-z0-9-]{0,60}[a-z0-9])?\.){1,3}[a-z]{2,}$'
    local cfpat=`node $CFHOSTPAT_JS cfhostRE|sed -r 's|^/(.*)/$|\1|'`
    while read -r d; do
      ([[ ! $d =~ $pat ]] || [[ $d =~ $cfpat ]]) && sed -i '/'$d'/d' remote.txt && echo delete $d from remote.txt
    done < remote.txt
    echo "diff local, `wc -l remote.txt`" >> $GITHUB_STEP_SUMMARY
    
    if [ -s remote.txt ]; then
      filterhost remote.txt > tmp && mv tmp remote.txt
      echo "filter, `wc -l remote.txt`" >> $GITHUB_STEP_SUMMARY
    fi

    if once_day || week_plan; then
      local sensitivePat=`cat $SENSITIVE_TXT`
      while read -r d; do
        [[ $d =~ $sensitivePat ]] && echo $d >> remains.txt &&  sed -i '/'$d'/d' remote.txt && echo remove sensitive $d from remote.txt
      done < remote.txt
      echo "filter sensitive, `wc -l remote.txt`" >> $GITHUB_STEP_SUMMARY
      
      # head -1000 remote.txt > tmp
      # tail --lines=+1001 remote.txt >> remains.txt && mv tmp remote.txt
      local remains=`file_lines_tojson remains.txt`
      ret=`file_lines_tojson remote.txt`
      if [ "$ret" != "$bak" ]; then 
        echo "kvCfhostChanged=true" >> $GITHUB_ENV;
        # echo `comm -23 remote.txt remote_bak.txt`
        curl -X PUT -H "$AUTH" -d "$ret" "$CF_KV_API/$CFHOST_BAK"
      fi
      curl -X PUT -H "$AUTH" -d "$remains" "$CF_KV_API/$CFHOST"
    else
      local rst=`file_lines_tojson remote.txt`
      if [ "$rst" != "$ret" ]; then
        curl -X PUT -H "$AUTH" -d "$rst" "$CF_KV_API/$CFHOST"
      fi
    fi
  fi
}
check_change(){
  if [ `git diff $CFHOST_JSON $CFHOSTPAT_JSON | wc -l` != 0 ]; then
    git config user.name "GitHub Actions Bot"
    git config user.email "<>"
    git add $CFHOST_JSON $CFHOSTPAT_JSON
    git commit -m "update local $CFHOST"
    git push
    echo "local $CFHOST changed." >> $GITHUB_STEP_SUMMARY
    localCfhostChanged=true
  fi
  ([ "$kvCfhostChanged" = true ] || [ "$localCfhostChanged" = true ]) && exit;
  ([ "$shouldDeploy" = true ] || [ $EVENT_NAME = push ] || [ $EVENT_NAME = workflow_dispatch ]) && exit;
  
  # cancel when trigger on schedule # [ -z `git diff --name-only $BEFORE $AFTER 2>&1` ]
  # and when now - (updated time of proxys data) >= 7200s
  #df='+%Y-%m-%d %H:%M:%S %z'
  #s=`curl -H "$AUTH" "$CF_KV_API/$PROXYS_UPDATED"`
  #echo "$ret"|grep error && s=0 || echo "$PROXYS_UPDATED: `date "$df" -d @$s`, now: `date "$df"`" >> $GITHUB_STEP_SUMMARY
  #if [ $((`date +%s` - $s)) -ge 7000 ]; then
  echo "on schedule $SCHEDULE, no change, no need to deploy" >> $GITHUB_STEP_SUMMARY
  gh run cancel $RUN_ID
  gh run watch $RUN_ID
}
prepare_data(){
  file_lines_tojson -u remote.txt local.txt > $CFHOST_JSON
  if [ ! -z "$proxys" ]; then
    echo $proxys > $PROXYS_JSON
  elif ! grep '"' $PROXYS_JSON; then
    ret=`curl -H "$AUTH" "$CF_KV_API/proxys"`
    grep error <<< "$ret" && echo "$ret" >> $GITHUB_STEP_SUMMARY && exit 1 || echo "$ret" > $PROXYS_JSON
  fi
}
check_status(){
  if [ ! -z $pageUrl ]; then
    pageUrl=`echo $pageUrl | sed -r 's/\w+\.(.*)\.pages/\1.pages/'`
    sleep 1m
    r=`curl -A "$UA" --connect-timeout 5 --retry 1 -s -w ' code=%{http_code}' $pageUrl`
    eval `echo $r|sed -r 's/^.*(code=.*)$/\1/'`
    if [ "$code" = 500 ]; then
      echo $r
      # maybe new sensitive host were added to remote.txt
      if echo $r | grep -e 'error.code..1101'; then
        echo "The page returned 'error code: 1101'! Please check the new added hosts:" >> $GITHUB_STEP_SUMMARY
        echo `comm -23 remote.txt remote_bak.txt` >> $GITHUB_STEP_SUMMARY
        exit 1
      fi
    fi
  fi
}