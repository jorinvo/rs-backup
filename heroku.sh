#!/bin/zsh

echo 'node_modules' > .gitignore
git add .
msg=$(date)
git commit -am $msg
git pull heroku master
git push heroku master
commit=$(git log | grep commit | head -2 | tail -1 | cut -d' ' -f2)
git reset --hard $commit