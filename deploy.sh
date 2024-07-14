#!/bin/bash

#-----------------------------------------------
NAME_PAT='^[a-z0-9]+(\-[a-z0-9]+)*[a-z0-9]*$'
AUTH="Authorization:Bearer $CF_API_TOKEN"
TYPE_FORMDATA="Content-Type:multipart/form-data"
TYPE_JSON="Content-Type:application/json"
FORM_FILE="_worker.js=@$ENTRY;type=application/javascript+module"
MAIN_MODULE='"main_module":"_worker.js"'
PLACEMENT='"placement":{"mode":"smart"}'
COMPATIBILITY_DATE='"compatibility_date":"2024-06-20"'
#--------------------------
upload_worker(){
	local fMetadata='metadata={'$MAIN_MODULE,$PLACEMENT,$COMPATIBILITY_DATE',"bindings":['$2']}'
	curl -X PUT -H "$AUTH" -H "$TYPE_FORMDATA" -F "$FORM_FILE" -F "$fMetadata" \
		$CF_SCRIPT_API/$1
}
put_script(){
	local fMetadata="metadata={$MAIN_MODULE}"
	curl -X PUT -H "$AUTH" -H "$TYPE_FORMDATA" -F "$FORM_FILE" -F "$fMetadata" \
		$CF_SCRIPT_API/$1/content
}
get_worker_settings(){
	curl -H "$AUTH" $CF_SCRIPT_API/$1/settings
}
patch_worker_settings(){
	local fSettings='settings={'$MAIN_MODULE,$PLACEMENT,$COMPATIBILITY_DATE',"bindings":['$2']}'
	curl -X PATCH -H "$AUTH" -H "$TYPE_FORMDATA" -F "$fSettings" \
		$CF_SCRIPT_API/$1/settings
}
worker_subdomain_enabled(){
	curl -H "$AUTH" $CF_SERVICE_API/$1/environments/production/subdomain|grep 'enabled": true'
}
enable_worker_subdomain(){
	local data='{"enabled":true}'
	curl -X POST -H "$AUTH" -H "$TYPE_JSON" -d "$data" $CF_SCRIPT_API/$1/subdomain
}
page_deployment(){
	local qs="?page=1&per_page=1&sort_by=created_on&sort_order=desc&env=$CF_PAGE_ENV"
	local ret=`curl -H "$AUTH" "$CF_PROJECT_API/$1/deployments$qs"`
	post_handle "$ret" 'had_page_deployment'
	jq -r '.result' <<< $ret
}
create_page(){
	[ $pageBranch != main ] && local preview=',"preview_branch":"'$pageBranch'"'
	local data='{"name":"'$1'","production_branch":"main"'$preview'}'
	curl -X POST -H "$AUTH" -H "$TYPE_JSON" -d "$data" $CF_PROJECT_API
}
upload_page(){
	local fManifest='manifest={}' fBranch="branch=$pageBranch"
	curl -X POST -H "$AUTH" -H "$TYPE_FORMDATA" -F "$FORM_FILE" -F "$fManifest" -F "$fBranch" \
		$CF_PROJECT_API/$1/deployments
}
patch_page(){
	local data='{"deployment_configs":{"'$CF_PAGE_ENV'":{'$PLACEMENT,$2'}}}'
	curl -X PATCH -H "$AUTH" -H "$TYPE_JSON" -d "$data" $CF_PROJECT_API/$1
}
#-------------------
generate_bindings(){
	echo '{"type":"plain_text","name":"'$UUID'","text":"'$1'"},{"type":"kv_namespace","name":"'$KV'","namespace_id":"'$CF_NAMESPACE_ID'"}'
}
generate_configs(){
	echo '"env_vars":{"'$UUID'":{"type":"plain_text","value":"'$1'"}},"kv_namespaces":{"'$KV'":{"namespace_id":"'$CF_NAMESPACE_ID'"}}'
}
post_handle(){
	# grep -qE 'success": ?false'<<< "$1" && echo $ret >&2 && return 1 || echo "$2 success" >> $GITHUB_STEP_SUMMARY
	grep -qE 'success": ?false'<<< "$1" && echo $ret >&2 && return 1 || echo "$2 success" >&2
}
warn_no_uuid(){
	[ "$1" != "WORKER" ] && [ "$1" != "PAGE" ] && echo error $1 && return
	echo "Warning: $1 UUID is empty! you can set a repo secret named 'CF_${1}_UUID' or fill in cloudflare dashboard worker settings then try again" | tee -a $GITHUB_STEP_SUMMARY
}

[ ! -s "$ENTRY" ] && echo "$ENTRY not found!" && exit 1;

deploy_worker(){
	[ -z $1 ] && echo "CF_WORKER_NAME is required!" && return;
	echo "deploy worker $1 ..." >> $GITHUB_STEP_SUMMARY

	if [ ! -z $2 ]; then
		bindings=`generate_bindings $2`
		ret=`upload_worker $1 $bindings`
		post_handle "$ret" 'upload_worker' || exit 1
	else
		ret=`put_script $1`
		post_handle "$ret" 'put_script' || exit 1
		ret=`get_worker_settings $1`
		local nsid=`jq -r '.result.bindings[] | select(.name == "'$KV'") | .namespace_id' <<< $ret`
		local uuid=`jq -r '.result.bindings[] | select(.name == "'$UUID'") | .text' <<< $ret`
		compatDate=`jq -r '.result.compatibility_date' <<< $ret`
		[ -z $uuid ] && warn_no_uuid WORKER
		if [ -z $nsid ] || [ $nsid != $CF_NAMESPACE_ID ] || [ -z $compatDate ]; then
			bindings=`generate_bindings $uuid`
			ret=`patch_worker_settings $1 $bindings`
			post_handle "$ret" 'patch_worker_settings' || exit 1
		fi
	fi
	worker_subdomain_enabled $1 || enable_worker_subdomain $1
}
deploy_page(){
	[ ! $deployPage ] && exit;
	[ -z $1 ] && echo "CF_PAGE_NAME is required!" && return;
	local n=$1; 
	[[ $1 =~ -[a-z0-9]{3,} ]] && n=${1%-*}-***
	echo "deploy page $n ..." >> $GITHUB_STEP_SUMMARY
	
	ret=`page_deployment $1`
	if [ "$ret" == null ]; then
		ret=`create_page $1`
		post_handle "$ret" 'create_page' || exit 1
		configs=`generate_configs $2`
	elif [ "$ret" == [] ]; then
		configs=`generate_configs $2`
	else
		local uuid=`jq -r '.[0].env_vars.'$UUID'.value' <<< $ret`
		local nsid=`jq -r '.[0].kv_namespaces.'$KV'.namespace_id' <<< $ret`
		if [ ! -z $2 ] && [ "$uuid" != "$2" ]; then
			configs=`generate_configs $2`
		elif [ -z $nsid ] || [ $nsid != $CF_NAMESPACE_ID ]; then
			configs=`generate_configs $uuid`
		elif [ -z $uuid ]; then
			warn_no_uuid PAGE
		fi
	fi
	if [ ! -z $configs ]; then
		ret=`patch_page $1 $configs`
		post_handle "$ret" 'patch_page' || exit 1
	fi
	ret=`upload_page $1`
	post_handle "$ret" 'upload_page' 
	if [ $? != 0 ]; then
		sleep .5
		ret=`upload_page $1`
		post_handle "$ret" 'retry upload_page'
	fi
}

deploy(){
	local names=(`echo "$1" | tr -s ' ' '\n'|head -n 20`)
	local uuids=(`echo "$2" | tr -s ' ' '\n'|head -n 20`)
	local name uuid
	for ((i=0; i<${#names[@]}; i++)); do
		name=${names[$i]}
		uuid=${uuids[$i]}
		# echo "$n" | grep -P "$NAME_PAT"
		[[ "$name" =~ $NAME_PAT ]] && $3 $name $uuid && sleep .5 || echo "invalid name: $name"
	done
}

[ -z "$workerName" ] && echo 'empty CF_WORKER_NAME' || deploy "$workerName" "$CF_WORKER_UUID" deploy_worker
[ "$deployPage" = false ] && echo 'no deploy page' && exit
[ -z "$pageName" ] && echo 'empty CF_PAGE_NAME' && exit
echo >> $GITHUB_STEP_SUMMARY
deploy "$pageName" "$CF_PAGE_UUID" deploy_page