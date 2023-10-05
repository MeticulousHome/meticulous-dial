#!bin/bash

FILE_URL=./src/meticulous-version.js
CUSTOM_COMMENT="// meticulous-version"
VERSION_SENTENCE="module.exports = { version: \"$1\" };"

if [ -f "$FILE_URL" ]
then 
	if grep -Fxq "$CUSTOM_COMMENT" "$FILE_URL"
	then 
		echo "overriting exist version file" && echo -e "$CUSTOM_COMMENT\n\n$VERSION_SENTENCE" > "$FILE_URL"
	else 
		echo "VERSION FILE NOT VALID, UPDATED AVOIDED" 
		exit 1
	fi
else
 	echo "creating version file" && echo -e "$CUSTOM_COMMENT\n\n$VERSION_SENTENCE" > "$FILE_URL"
fi

npm run format

exit