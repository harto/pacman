STATICS := $(subst web, .build, $(wildcard web/*))
JAVASCRIPTS := $(wildcard src/*.js)

.PHONY: all lint deploy clean

all: .build/pacman.js

.build/pacman.js: $(JAVASCRIPTS) $(STATICS)
	cat `bin/dependency-order $(JAVASCRIPTS)` >.build/pacman.js

.build/%: web/% | .build
	cp -R $< $@

.build:
	mkdir -p .build

lint:
	jslint $(JAVASCRIPTS)

deploy: .build
	bin/deploy .build

clean:
	rm -rf .build
