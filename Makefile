JAVASCRIPTS = $(wildcard src/*.js)
DEPLOYABLE_FILES = index.html pacman.js pacman.css analytics.js res

.PHONY: lint deploy clean

pacman.js: $(JAVASCRIPTS)
	cat `python tools/dependency-order.py $(JAVASCRIPTS)` >pacman.js

lint:
	jslint $(JAVASCRIPTS)

.build: $(DEPLOYABLE_FILES)
	mkdir -p .build
	cp -R $(DEPLOYABLE_FILES) .build

deploy: .build
	./deploy.sh .build

clean:
	rm -f pacman.js .build
