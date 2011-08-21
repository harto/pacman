ALL=$(wildcard src/*.js)

pacman.js: $(ALL)
	cat `python tools/dependency-order.py $(ALL)` >pacman.js

.PHONY=lint clean

lint:
	jslint $(ALL)

clean:
	rm pacman.js
