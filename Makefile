heroku:
	cat .gitignore | tail -1 > .gitignore
	git add .
	date | git commit -am
	git push heroku master
	commit=git log | grep commit | head -2 | tail -1 | cut -d' ' -f2
	git reset --hard $commit
