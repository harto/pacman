STATICS := $(subst static, .build, $(wildcard static/*))
JAVASCRIPTS := $(wildcard src/*.js)

.PHONY: all lint deploy clean

all: .build/pacman.js

.build/pacman.js: $(JAVASCRIPTS) $(STATICS) .build/res
	cat `script/dependency-order $(JAVASCRIPTS)` >.build/pacman.js

.build/res: res | .build
	cp -R res .build/res

.build/%: static/% | .build
	cp -R $< $@

.build:
	mkdir -p .build

lint:
	jslint $(JAVASCRIPTS)

deploy: .build
	script/deploy .build

clean:
	rm -rf .build
